import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const notifyPaymentReceived = inngest.createFunction(
  {
    id: "notify-payment-received",
    retries: 3,
    concurrency: [{ key: "event.data.chargeId", limit: 1 }],
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
            title: `[FALHA PAGAMENTO] Status não atualizado para cobrança ${data.chargeId}`,
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
  { event: "charge/paid" },
  async ({ event }) => {
    const { chargeId, customerId } = event.data;

    // Update charge status if not already PAID
    const charge = await prisma.charge.findUnique({ where: { id: chargeId } });
    if (charge && charge.status !== "PAID") {
      await prisma.charge.update({
        where: { id: chargeId },
        data: { status: "PAID", paidAt: new Date() },
      });
    }

    return { chargeId, customerId, processed: true };
  }
);
