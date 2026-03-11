import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import type { AgentAction } from "@prisma/client";

export const logAgentDecision = inngest.createFunction(
  {
    id: "log-agent-decision",
    retries: 3,
  },
  [
    { event: "ai/collection-decided" },
    { event: "ai/inbound-decided" },
  ],
  async ({ event }) => {
    const { action, confidence, reasoning, franqueadoraId } = event.data;

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
