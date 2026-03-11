import { inngest } from "../client";
import { executeEscalation } from "@/lib/agent/escalation";
import type { EscalationReason } from "@prisma/client";

export const handleEscalation = inngest.createFunction(
  {
    id: "handle-escalation",
    retries: 5,
    concurrency: [{ key: "event.data.conversationId || event.data.customerId", limit: 1 }],
  },
  { event: "ai/escalation-triggered" },
  async ({ event }) => {
    const { conversationId, customerId, reason, details, franqueadoraId } = event.data;

    if (conversationId) {
      await executeEscalation(
        conversationId,
        customerId,
        reason as EscalationReason,
        details || "",
        franqueadoraId
      );
    }

    return { escalated: true, conversationId, reason };
  }
);
