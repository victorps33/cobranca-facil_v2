import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const ruleId = searchParams.get("ruleId");

  const steps = await prisma.dunningStep.findMany({
    where: {
      rule: { franqueadoraId: tenantId!, ...(ruleId ? { id: ruleId } : {}) },
      enabled: true,
    },
    include: {
      resolverStats: true,
      variants: {
        where: { active: true },
        orderBy: { conversionRate: "desc" },
      },
    },
    orderBy: [{ trigger: "asc" }, { offsetDays: "asc" }],
  });

  const smartSteps = steps.filter(
    (s) =>
      s.timingMode === "SMART" ||
      s.channelMode === "SMART" ||
      s.contentMode === "SMART"
  );

  // Aggregate KPIs
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalSent, totalPaid] = await Promise.all([
    prisma.engagementEvent.count({
      where: {
        franqueadoraId: tenantId!,
        eventType: "SENT",
        occurredAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.engagementEvent.count({
      where: {
        franqueadoraId: tenantId!,
        eventType: "PAID",
        occurredAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  return NextResponse.json({
    steps,
    kpis: {
      totalSteps: steps.length,
      smartSteps: smartSteps.length,
      totalSent,
      totalPaid,
      recoveryRate: totalSent > 0 ? totalPaid / totalSent : 0,
    },
  });
}
