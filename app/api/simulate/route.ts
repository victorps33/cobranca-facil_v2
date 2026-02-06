import { NextRequest, NextResponse } from "next/server";

// POST /api/simulate — Avançar N dias na simulação
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const days = body.days || 7;

    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    // Busca estado atual
    const appState = await prisma.appState.findFirst({ where: { id: 1 } });
    const currentDate = appState?.simulatedNow || new Date();
    const newDate = new Date(currentDate.getTime() + days * 24 * 60 * 60 * 1000);

    // Atualiza ou cria estado
    await prisma.appState.upsert({
      where: { id: 1 },
      update: { simulatedNow: newDate },
      create: { id: 1, simulatedNow: newDate },
    });

    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      previousDate: currentDate.toISOString(),
      newDate: newDate.toISOString(),
      daysAdvanced: days,
    });
  } catch (error) {
    return NextResponse.json({ error: "Falha na simulação" }, { status: 500 });
  }
}
