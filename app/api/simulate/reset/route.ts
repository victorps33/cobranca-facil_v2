import { NextResponse } from "next/server";

// POST /api/simulate/reset — Resetar para data real
export async function POST() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    await prisma.appState.upsert({
      where: { id: 1 },
      update: { simulatedNow: null },
      create: { id: 1, simulatedNow: null },
    });

    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      date: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: "Falha ao resetar data" }, { status: 500 });
  }
}
