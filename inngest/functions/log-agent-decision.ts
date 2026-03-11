import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import type { AgentAction } from "@prisma/client";

export const logAgentDecision = inngest.createFunction(
  {
    id: "log-agent-decision",
    retries: 3,
    concurrency: [{ key: "event.data.customerId", limit: 1 }],
  },
  [
    { event: "ai/collection-decided" },
    { event: "ai/inbound-decided" },
  ],
  async ({ event }) => {
    const { action, confidence, reasoning, franqueadoraId } = event.data;

    // Idempotency: check for recent duplicate
    const existing = await prisma.agentDecisionLog.findFirst({
      where: {
        customerId: event.data.customerId,
        action: action as AgentAction,
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });

    if (existing) {
      return { logged: false, reason: "duplicate" };
    }

    await prisma.agentDecisionLog.create({
      data: {
        chargeId: "chargeId" in event.data ? event.data.chargeId : undefined,
        conversationId: "conversationId" in event.data ? event.data.conversationId : undefined,
        customerId: event.data.customerId,
        action: action as AgentAction,
        confidence,
        reasoning,
        inputContext: JSON.stringify(event.data),
        franqueadoraId,
        executedAt: new Date(),
      },
    });

    return { logged: true, action };
  }
);
