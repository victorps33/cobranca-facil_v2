import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

// GET /api/app-state — Retorna estado atual da aplicação
export async function GET() {
  const { session, error } = await requireTenant();
  if (error) return error;

  const franqueadoraId = session!.user.franqueadoraId as string;
  const tenantFilter = { customer: { franqueadoraId } };

  try {
    const appState = await prisma.appState.findFirst({ where: { id: 1 } });
    const now = appState?.simulatedNow || new Date();
    const isSimulated = !!appState?.simulatedNow;

    const [total, pending, paid, overdue] = await Promise.all([
      prisma.charge.count({ where: tenantFilter }),
      prisma.charge.count({ where: { ...tenantFilter, status: "PENDING" } }),
      prisma.charge.count({ where: { ...tenantFilter, status: "PAID" } }),
      prisma.charge.count({ where: { ...tenantFilter, status: "OVERDUE" } }),
    ]);

    const totalAmountResult = await prisma.charge.aggregate({
      where: tenantFilter,
      _sum: { amountCents: true },
    });
    const paidAmountResult = await prisma.charge.aggregate({
      where: { ...tenantFilter, status: "PAID" },
      _sum: { amountCents: true },
    });

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
    // Return zeros if DB is empty or unavailable
    return NextResponse.json({
      date: new Date().toISOString(),
      isSimulated: false,
      demoDate: null,
      stats: {
        total: 0,
        pending: 0,
        paid: 0,
        overdue: 0,
        totalAmount: 0,
        paidAmount: 0,
      },
    });
  }
}
