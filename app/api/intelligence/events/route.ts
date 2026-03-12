import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const stepId = searchParams.get("stepId");
  const type = searchParams.get("type"); // 'heatmap' | 'channels'

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (type === "heatmap" && stepId) {
    const events = await prisma.engagementEvent.findMany({
      where: {
        stepId,
        eventType: "READ",
        occurredAt: { gte: thirtyDaysAgo },
      },
      select: { occurredAt: true },
    });

    // Build heatmap: day of week x hour
    const heatmap: Record<string, Record<string, number>> = {};
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    for (const e of events) {
      const day = days[e.occurredAt.getDay()];
      const hour = e.occurredAt.getHours().toString();
      if (!heatmap[day]) heatmap[day] = {};
      heatmap[day][hour] = (heatmap[day][hour] || 0) + 1;
    }

    return NextResponse.json({ heatmap, totalEvents: events.length });
  }

  if (type === "channels" && stepId) {
    const sent = await prisma.engagementEvent.groupBy({
      by: ["channel"],
      where: {
        stepId,
        eventType: "SENT",
        occurredAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    });

    const replied = await prisma.engagementEvent.groupBy({
      by: ["channel"],
      where: {
        stepId,
        eventType: "REPLIED",
        occurredAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    });

    const paid = await prisma.engagementEvent.groupBy({
      by: ["channel"],
      where: {
        stepId,
        eventType: "PAID",
        occurredAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    });

    return NextResponse.json({ sent, replied, paid });
  }

  return NextResponse.json(
    { error: "type and stepId required" },
    { status: 400 }
  );
}
