import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export async function GET() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalDecisions,
      decisionsToday,
      decisions7d,
      escalationsActive,
      escalationsTotal,
      conversationsOpen,
      conversationsPendingHuman,
      avgConfidence,
      actionBreakdown,
    ] = await Promise.all([
      prisma.agentDecisionLog.count({
        where: { franqueadoraId: tenantId! },
      }),
      prisma.agentDecisionLog.count({
        where: { franqueadoraId: tenantId!, createdAt: { gte: todayStart } },
      }),
      prisma.agentDecisionLog.count({
        where: { franqueadoraId: tenantId!, createdAt: { gte: last7Days } },
      }),
      prisma.conversation.count({
        where: { franqueadoraId: tenantId!, status: "PENDENTE_HUMANO" },
      }),
      prisma.agentDecisionLog.count({
        where: {
          franqueadoraId: tenantId!,
          action: "ESCALATE_HUMAN",
        },
      }),
      prisma.conversation.count({
        where: { franqueadoraId: tenantId!, status: "ABERTA" },
      }),
      prisma.conversation.count({
        where: { franqueadoraId: tenantId!, status: "PENDENTE_HUMANO" },
      }),
      prisma.agentDecisionLog.aggregate({
        where: {
          franqueadoraId: tenantId!,
          createdAt: { gte: last30Days },
        },
        _avg: { confidence: true },
      }),
      prisma.agentDecisionLog.groupBy({
        by: ["action"],
        where: {
          franqueadoraId: tenantId!,
          createdAt: { gte: last30Days },
        },
        _count: true,
      }),
    ]);

    // Message stats from the Message model
    const [messagesSent, messagesFailed] = await Promise.all([
      prisma.message.count({
        where: {
          conversation: { franqueadoraId: tenantId! },
          createdAt: { gte: last30Days },
          sender: "AI",
        },
      }),
      prisma.message.count({
        where: {
          conversation: { franqueadoraId: tenantId! },
          createdAt: { gte: last30Days },
          metadata: { contains: '"deliveryStatus":"FAILED"' },
        },
      }),
    ]);
    const messagesQueued = 0; // No longer applicable with Inngest

    const config = await prisma.agentConfig.findUnique({
      where: { franqueadoraId: tenantId! },
    });

    return NextResponse.json({
      totalDecisions,
      decisionsToday,
      decisions7d,
      escalationsActive,
      escalationsTotal,
      messagesSent,
      messagesFailed,
      messagesQueued,
      conversationsOpen,
      conversationsPendingHuman,
      avgConfidence: avgConfidence._avg.confidence || 0,
      actionBreakdown: actionBreakdown.map((a) => ({
        action: a.action,
        count: a._count,
      })),
      agentEnabled: config?.enabled ?? false,
    });
  } catch (err) {
    console.error("[Agent Dashboard] Error:", err);
    return NextResponse.json(
      { error: "Falha ao carregar dashboard" },
      { status: 500 }
    );
  }
}
