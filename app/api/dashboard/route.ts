import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";
import { headers } from "next/headers";

export async function GET() {
  const headerList = headers();
  const requestedId = headerList.get("x-franqueadora-id") || null;
  const { tenantIds, error } = await requireTenantOrGroup(
    requestedId === "all" ? null : requestedId
  );
  if (error) return error;

  try {
    // Fetch all charges for this tenant (or group) with customer info
    const charges = await prisma.charge.findMany({
      where: { customer: { franqueadoraId: { in: tenantIds } } },
      include: { customer: { select: { name: true, id: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (charges.length === 0) {
      return NextResponse.json({ empty: true, kpis: null, charts: null });
    }

    // ── Derive competências from charges ──
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const competencias = new Set<string>();
    charges.forEach((c) => {
      if (c.competencia) {
        competencias.add(c.competencia);
      } else {
        // Fallback: derive from dueDate
        const d = new Date(c.dueDate);
        const derived = `${meses[d.getMonth()]}/${d.getFullYear()}`;
        competencias.add(derived);
        // Mutate in-place so downstream filters work
        (c as any).competencia = derived;
      }
    });

    // Sort competencias chronologically (format: "Mmm/YYYY")
    const sortedCompetencias = Array.from(competencias).sort((a, b) => {
      const [mesA, anoA] = a.split("/");
      const [mesB, anoB] = b.split("/");
      const dateA = parseInt(anoA) * 12 + meses.indexOf(mesA);
      const dateB = parseInt(anoB) * 12 + meses.indexOf(mesB);
      return dateB - dateA; // newest first
    });

    // ── Compute KPIs for each competência ──
    const kpisByCompetencia: Record<string, {
      totalEmitido: number;
      totalRecebido: number;
      totalAberto: number;
      total: number;
      pagas: number;
      vencidas: number;
      abertas: number;
    }> = {};

    for (const comp of sortedCompetencias) {
      const cobsDoMes = charges.filter((c) => c.competencia === comp);
      const totalEmitido = cobsDoMes.reduce((s, c) => s + c.amountCents, 0);
      const totalRecebido = cobsDoMes.filter((c) => c.status === "PAID").reduce((s, c) => s + c.amountCents, 0);
      const totalAberto = cobsDoMes.filter((c) => c.status === "PENDING" || c.status === "OVERDUE").reduce((s, c) => s + c.amountCents, 0);

      kpisByCompetencia[comp] = {
        totalEmitido,
        totalRecebido,
        totalAberto,
        total: cobsDoMes.length,
        pagas: cobsDoMes.filter((c) => c.status === "PAID").length,
        vencidas: cobsDoMes.filter((c) => c.status === "OVERDUE").length,
        abertas: cobsDoMes.filter((c) => c.status === "PENDING").length,
      };
    }

    // ── Chart data (chronological order, last 5) ──
    const chartCompetencias = sortedCompetencias.slice(0, 5).reverse();

    const shortLabel = (comp: string): string => {
      const [mes, ano] = comp.split("/");
      return `${mes}/${ano.slice(2)}`;
    };

    const revenueData = chartCompetencias.map((comp) => {
      const kpi = kpisByCompetencia[comp];
      return {
        month: shortLabel(comp),
        revenue: Math.round(kpi.totalRecebido / 100),
        projected: Math.round(kpi.totalEmitido / 100),
      };
    });

    const chargesStatusData = chartCompetencias.map((comp) => {
      const kpi = kpisByCompetencia[comp];
      return {
        month: shortLabel(comp),
        pagas: kpi.pagas,
        pendentes: kpi.abertas,
        vencidas: kpi.vencidas,
      };
    });

    const paymentMethodsData = chartCompetencias.map((comp) => {
      const cobsDoMes = charges.filter((c) => c.competencia === comp);
      return {
        month: shortLabel(comp),
        boleto: Math.round(cobsDoMes.filter((c) => c.formaPagamento === "Boleto").reduce((s, c) => s + c.amountCents, 0) / 100),
        pix: Math.round(cobsDoMes.filter((c) => c.formaPagamento === "Pix").reduce((s, c) => s + c.amountCents, 0) / 100),
        cartao: Math.round(cobsDoMes.filter((c) => c.formaPagamento === "Cartão").reduce((s, c) => s + c.amountCents, 0) / 100),
      };
    });

    // ── Impact summary (unfiltered, always shows global picture) ──
    const now = new Date();
    const thisMonth = `${meses[now.getMonth()]}/${now.getFullYear()}`;

    // "Rede em dia" — % of customers with no overdue charges
    const customerIds = new Set(charges.map((c) => c.customerId));
    const customersWithOverdue = new Set(
      charges.filter((c) => c.status === "OVERDUE").map((c) => c.customerId)
    );
    const redeEmDia = customerIds.size > 0
      ? Math.round(((customerIds.size - customersWithOverdue.size) / customerIds.size) * 100)
      : 0;

    // "Recuperados este mês" — value paid this month
    const recuperadosEsteMes = charges
      .filter((c) => c.status === "PAID" && c.paidAt && c.paidAt.getMonth() === now.getMonth() && c.paidAt.getFullYear() === now.getFullYear())
      .reduce((s, c) => s + c.amountCents, 0);

    // "Em risco" — total overdue value
    const emRisco = charges
      .filter((c) => c.status === "OVERDUE")
      .reduce((s, c) => s + c.amountCents, 0);

    // "Melhorando" / "Piorando" — compare each customer's overdue rate between last 2 competências
    let melhorando = 0;
    let piorando = 0;
    if (sortedCompetencias.length >= 2) {
      const currComp = sortedCompetencias[0];
      const prevComp = sortedCompetencias[1];

      const customerOverdueRate = (comp: string) => {
        const rates = new Map<string, { total: number; overdue: number }>();
        charges.filter((c) => c.competencia === comp).forEach((c) => {
          const entry = rates.get(c.customerId) || { total: 0, overdue: 0 };
          entry.total++;
          if (c.status === "OVERDUE") entry.overdue++;
          rates.set(c.customerId, entry);
        });
        return rates;
      };

      const currRates = customerOverdueRate(currComp);
      const prevRates = customerOverdueRate(prevComp);

      for (const custId of Array.from(customerIds)) {
        const curr = currRates.get(custId);
        const prev = prevRates.get(custId);
        if (!curr || !prev) continue;
        const currRate = curr.overdue / curr.total;
        const prevRate = prev.overdue / prev.total;
        if (currRate < prevRate) melhorando++;
        else if (currRate > prevRate) piorando++;
      }
    }

    return NextResponse.json({
      empty: false,
      competencias: sortedCompetencias.map((c) => ({
        label: shortLabel(c),
        value: c,
      })),
      kpisByCompetencia,
      charts: {
        revenueData,
        chargesStatusData,
        paymentMethodsData,
      },
      impact: {
        redeEmDia,
        recuperadosEsteMes,
        emRisco,
        melhorando,
        piorando,
      },
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
