import { NextResponse } from "next/server";

// GET /api/app-state — Retorna estado atual da aplicação (data simulada, stats)
export async function GET() {
  // Tenta buscar do banco, fallback para dados dummy
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const appState = await prisma.appState.findFirst({ where: { id: 1 } });
    const now = appState?.simulatedNow || new Date();
    const isSimulated = !!appState?.simulatedNow;

    const [total, pending, paid, overdue] = await Promise.all([
      prisma.charge.count(),
      prisma.charge.count({ where: { status: "PENDING" } }),
      prisma.charge.count({ where: { status: "PAID" } }),
      prisma.charge.count({ where: { status: "OVERDUE" } }),
    ]);

    const totalAmountResult = await prisma.charge.aggregate({ _sum: { amountCents: true } });
    const paidAmountResult = await prisma.charge.aggregate({
      where: { status: "PAID" },
      _sum: { amountCents: true },
    });

    await prisma.$disconnect();

    return NextResponse.json({
      date: now.toISOString(),
      isSimulated,
      demoDate: isSimulated ? now.toISOString() : null,
      stats: {
        total,
        pending,
        paid,
        overdue,
        totalAmount: totalAmountResult._sum.amountCents || 0,
        paidAmount: paidAmountResult._sum.amountCents || 0,
      },
    });
  } catch {
    // Fallback: retorna dados dummy se o banco não estiver disponível
    return NextResponse.json({
      date: new Date().toISOString(),
      isSimulated: false,
      demoDate: null,
      stats: {
        total: 25,
        pending: 8,
        paid: 14,
        overdue: 3,
        totalAmount: 15750000,
        paidAmount: 9820000,
      },
    });
  }
}
