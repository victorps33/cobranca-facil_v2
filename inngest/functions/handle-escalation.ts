import { inngest } from "../client";
import { executeEscalation } from "@/lib/agent/escalation";
import type { EscalationReason } from "@prisma/client";

export const handleEscalation = inngest.createFunction(
  {
    id: "handle-escalation",
    retries: 5,
    concurrency: [{ key: "event.data.conversationId || event.data.customerId", limit: 1 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (systemUser && data.customerId) {
        await p.collectionTask.create({
          data: {
            title: `[FALHA ESCALAÇÃO] Escalação falhou após 5 retries`,
            description: `Erro: ${error.message}\nMotivo: ${data.reason}\nDetalhes: ${data.details}`,
            priority: "CRITICA",
            status: "PENDENTE",
            customerId: data.customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  { event: "ai/escalation-triggered" },
  async ({ event }) => {
    const { conversationId, customerId, reason, details, franqueadoraId } = event.data;

    if (!conversationId) {
      return { escalated: false, reason: "no-conversation-id" };
    }

    await executeEscalation(
      conversationId,
      customerId,
      reason as EscalationReason,
      details || "",
      franqueadoraId
    );

    return { escalated: true, conversationId, reason };
  }
);
