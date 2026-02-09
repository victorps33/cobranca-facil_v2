import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/dunning-steps
export async function GET() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const steps = await prisma.dunningStep.findMany({
      where: { rule: { franqueadoraId: tenantId! } },
      include: { rule: true },
      orderBy: { offsetDays: "asc" },
    });
    return NextResponse.json(steps);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/dunning-steps — Criar step
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const body = await req.json();

    // Verify rule belongs to tenant
    const rule = await prisma.dunningRule.findFirst({
      where: { id: body.ruleId, franqueadoraId: tenantId! },
    });
    if (!rule) {
      return NextResponse.json({ error: "Régua não encontrada" }, { status: 404 });
    }

    const step = await prisma.dunningStep.create({
      data: {
        ruleId: body.ruleId,
        trigger: body.trigger,
        offsetDays: body.offsetDays,
        channel: body.channel,
        template: body.template,
        enabled: body.enabled ?? true,
      },
    });
    return NextResponse.json(step, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao criar step" }, { status: 500 });
  }
}
