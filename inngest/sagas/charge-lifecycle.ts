import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const chargeLifecycle = inngest.createFunction(
  {
    id: "charge-lifecycle",
    retries: 3,
  },
  { event: "charge/created" },
  async ({ event, step }) => {
    const { chargeId, dueDate, customerId, franqueadoraId } = event.data;

    // Step 1: Generate boleto
    await step.run("generate-boleto", async () => {
      const charge = await prisma.charge.findUnique({
        where: { id: chargeId },
        include: { boleto: true },
      });

      if (charge && !charge.boleto) {
        // Generate simulated boleto
        const linhaDigitavel = `23793.38128 ${Date.now()} ${charge.amountCents}`;
        await prisma.boleto.create({
          data: {
            chargeId,
            linhaDigitavel,
            barcodeValue: linhaDigitavel.replace(/[.\s]/g, ""),
            publicUrl: `https://boleto.example.com/${chargeId}`,
          },
        });
      }
    });

    // Step 2: Sleep until due date
    await step.sleepUntil("wait-due-date", new Date(dueDate));

    // Step 3: Check if already paid
    const charge = await step.run("check-payment", async () => {
      return prisma.charge.findUnique({
        where: { id: chargeId },
        select: { status: true },
      });
    });

    if (!charge || charge.status === "PAID" || charge.status === "CANCELED") {
      return { chargeId, result: "already-resolved", status: charge?.status };
    }

    // Step 4: Emit overdue event
    await step.sendEvent("emit-overdue", {
      name: "charge/overdue",
      data: {
        chargeId,
        customerId,
        daysPastDue: 0,
        franqueadoraId,
      },
    });

    return { chargeId, result: "overdue-emitted" };
  }
);
