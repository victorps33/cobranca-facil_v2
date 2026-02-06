import { NextRequest, NextResponse } from "next/server";

// GET /api/dunning-steps
export async function GET() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const steps = await prisma.dunningStep.findMany({
      include: { rule: true },
      orderBy: { offsetDays: "asc" },
    });
    await prisma.$disconnect();
    return NextResponse.json(steps);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/dunning-steps — Criar step
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
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
    await prisma.$disconnect();
    return NextResponse.json(step, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Falha ao criar step" }, { status: 500 });
  }
}
