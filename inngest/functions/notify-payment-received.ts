import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const notifyPaymentReceived = inngest.createFunction(
  {
    id: "notify-payment-received",
    retries: 3,
    concurrency: [{ key: "event.data.chargeId", limit: 1 }],
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
