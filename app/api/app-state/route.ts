import { NextResponse } from "next/server";
import { cobrancasDummy, getCobrancasStats } from "@/lib/data/cobrancas-dummy";
import { ciclosHistorico } from "@/lib/data/apuracao-historico-dummy";

// GET /api/app-state — Retorna estado atual da aplicação (data simulada, stats)
export async function GET() {
  // Tenta buscar do banco, fallback para dados dummy derivados das cobranças
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
    // Fallback: dados derivados do ciclo mais recente (Jan/2026)
    const latestCiclo = ciclosHistorico[0];
    const cobsDoMes = cobrancasDummy.filter((c) => c.competencia === latestCiclo.competencia);
    const stats = getCobrancasStats(cobsDoMes);

    return NextResponse.json({
      date: new Date().toISOString(),
      isSimulated: false,
      demoDate: null,
      stats: {
        total: stats.total,
        pending: stats.byStatus.aberta,
        paid: stats.byStatus.paga,
        overdue: stats.byStatus.vencida,
        totalAmount: stats.totalEmitido,
        paidAmount: stats.totalPago,
      },
    });
  }
}
