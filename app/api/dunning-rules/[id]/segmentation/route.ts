import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { differenceInDays } from "date-fns";

const PHASE_ORDER = [
  "LEMBRETE",
  "VENCIMENTO",
  "ATRASO",
  "NEGATIVACAO",
  "COBRANCA_INTENSIVA",
  "PROTESTO",
  "POS_PROTESTO",
] as const;

function getPhaseIndex(phase: string): number {
  return PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  // 1. Fetch the rule with its enabled steps
  const rule = await prisma.dunningRule.findFirst({
    where: { id: params.id, franqueadoraId: tenantId! },
    include: {
      steps: {
        where: { enabled: true },
        orderBy: [{ trigger: "asc" }, { offsetDays: "asc" }],
      },
    },
  });

  if (!rule) {
    return NextResponse.json(
      { error: "Régua não encontrada" },
      { status: 404 }
    );
  }

  // 2. Build phase thresholds from steps
  const maxPhaseIdx = getPhaseIndex(rule.maxPhase);
  const activePhases = PHASE_ORDER.filter((_, i) => i <= maxPhaseIdx);

  // Map each step to its absolute day offset (negative = before due)
  const stepDays = rule.steps.map((s) => ({
    phase: s.phase,
    days:
      s.trigger === "BEFORE_DUE"
        ? -s.offsetDays
        : s.trigger === "ON_DUE"
          ? 0
          : s.offsetDays,
  }));

  // Build sorted phase boundaries
  const phaseBoundaries: { phase: string; startDay: number }[] = [];
  for (const phase of activePhases) {
    const phaseSteps = stepDays.filter((s) => s.phase === phase);
    if (phaseSteps.length > 0) {
      phaseBoundaries.push({
        phase,
        startDay: Math.min(...phaseSteps.map((s) => s.days)),
      });
    }
  }
  phaseBoundaries.sort((a, b) => a.startDay - b.startDay);

  // 3. Fetch customers with matching risk profile
  // Customers without a risk score default to BOM_PAGADOR
  const customers = await prisma.customer.findMany({
    where: {
      franqueadoraId: tenantId!,
      OR: [
        { riskScore: { riskProfile: rule.riskProfile } },
        ...(rule.riskProfile === "BOM_PAGADOR"
          ? [{ riskScore: { is: null } }]
          : []),
      ],
    },
    select: { id: true, name: true },
  });

  if (customers.length === 0) {
    return NextResponse.json({
      phases: activePhases,
      competencias: [],
      matrix: {},
      totalsByPhase: {},
      totalsByCompetencia: {},
    });
  }

  const customerMap = new Map(customers.map((c) => [c.id, c.name]));
  const customerIds = customers.map((c) => c.id);

  // 4. Fetch non-paid charges for these customers
  const charges = await prisma.charge.findMany({
    where: {
      customerId: { in: customerIds },
      status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
    },
    select: {
      id: true,
      customerId: true,
      dueDate: true,
      competencia: true,
    },
  });

  // 5. Determine phase for each charge based on days overdue
  const now = new Date();

  function determinePhase(daysOverdue: number): string {
    if (phaseBoundaries.length === 0) return activePhases[0] || "LEMBRETE";
    let matched = phaseBoundaries[0].phase;
    for (const b of phaseBoundaries) {
      if (daysOverdue >= b.startDay) {
        matched = b.phase;
      } else {
        break;
      }
    }
    return matched;
  }

  // 6. Build matrix: phase × competência
  type CellData = { count: number; customers: { id: string; name: string }[] };
  const matrix: Record<string, Record<string, CellData>> = {};
  const totalsByPhase: Record<string, number> = {};
  const totalsByCompetencia: Record<string, number> = {};
  const competenciasSet = new Set<string>();

  for (const charge of charges) {
    const daysOverdue = differenceInDays(now, new Date(charge.dueDate));
    const phase = determinePhase(daysOverdue);
    const comp = charge.competencia || "Sem competência";
    competenciasSet.add(comp);

    if (!matrix[phase]) matrix[phase] = {};
    if (!matrix[phase][comp])
      matrix[phase][comp] = { count: 0, customers: [] };

    const cell = matrix[phase][comp];
    if (!cell.customers.some((c) => c.id === charge.customerId)) {
      cell.customers.push({
        id: charge.customerId,
        name: customerMap.get(charge.customerId) || "—",
      });
    }
    cell.count = cell.customers.length;
  }

  // Compute totals
  for (const phase of Object.keys(matrix)) {
    let phaseTotal = 0;
    for (const comp of Object.keys(matrix[phase])) {
      phaseTotal += matrix[phase][comp].count;
    }
    totalsByPhase[phase] = phaseTotal;
  }
  const competencias = Array.from(competenciasSet).sort();

  for (const comp of competencias) {
    let compTotal = 0;
    for (const phase of Object.keys(matrix)) {
      compTotal += matrix[phase]?.[comp]?.count || 0;
    }
    totalsByCompetencia[comp] = compTotal;
  }

  return NextResponse.json({
    phases: activePhases,
    competencias,
    matrix,
    totalsByPhase,
    totalsByCompetencia,
  });
}
