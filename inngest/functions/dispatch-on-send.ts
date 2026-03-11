import { inngest } from "../client";
import { dispatchMessage } from "@/lib/agent/dispatch";

export const dispatchOnSend = inngest.createFunction(
  {
    id: "dispatch-on-send",
    retries: 3,
    concurrency: [{ key: "event.data.messageId", limit: 1 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      if (data.messageId) {
        await p.message.update({
          where: { id: data.messageId },
          data: {
            metadata: JSON.stringify({
              deliveryStatus: "FAILED",
              error: error.message,
              failedAt: new Date().toISOString(),
            }),
          },
        });
      }
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (systemUser && data.customerId) {
        await p.collectionTask.create({
          data: {
            title: `[FALHA ENVIO] Mensagem não entregue após retries`,
            description: `Erro: ${error.message}`,
            priority: "ALTA",
            status: "PENDENTE",
            customerId: data.customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  { event: "message/sent" },
  async ({ event }) => {
    const { messageId, channel, content, customerId, conversationId, franqueadoraId } = event.data;

    const result = await dispatchMessage({
      channel,
      content,
      customerId,
      conversationId,
      messageId,
      franqueadoraId,
    });

    if (!result.success) {
      throw new Error(`Dispatch failed: ${result.error}`);
    }

    return { dispatched: true, providerMsgId: result.providerMsgId };
  }
);
