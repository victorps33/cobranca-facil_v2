import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const handleDeliveryStatus = inngest.createFunction(
  {
    id: "handle-delivery-status",
    retries: 3,
    concurrency: [{ key: "event.data.providerMsgId", limit: 1 }],
  },
  [
    { event: "message/delivered" },
    { event: "message/failed" },
  ],
  async ({ event }) => {
    const { providerMsgId } = event.data;
    const isDelivered = event.name === "message/delivered";

    // Find message by provider ID
    const message = await prisma.message.findFirst({
      where: { externalId: providerMsgId },
      include: { conversation: true },
    });

    if (!message) {
      return { skipped: true, reason: "message not found" };
    }

    // Note: Message model has no `status` field — use `metadata` JSON to track delivery
    const existingMeta = message.metadata ? JSON.parse(message.metadata) : {};

    if (isDelivered) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          metadata: JSON.stringify({
            ...existingMeta,
            deliveryStatus: "DELIVERED",
            deliveredAt: new Date().toISOString(),
          }),
        },
      });
    } else {
      const error = (event.data as { error: string }).error;
      await prisma.message.update({
        where: { id: message.id },
        data: {
          metadata: JSON.stringify({
            ...existingMeta,
            deliveryStatus: "FAILED",
            error,
            failedAt: new Date().toISOString(),
          }),
        },
      });

      // Create collection task for failed delivery review
      const systemUser = await prisma.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });

      if (systemUser && message.conversation?.customerId) {
        await prisma.collectionTask.create({
          data: {
            title: `[FALHA ENVIO] Mensagem para conversa ${message.conversationId}`,
            description: `Entrega falhou: ${error}`,
            priority: "ALTA",
            status: "PENDENTE",
            customerId: message.conversation.customerId,
            createdById: systemUser.id,
          },
        });
      }
    }

    return { updated: true, messageId: message.id, status: isDelivered ? "DELIVERED" : "FAILED" };
  }
);
