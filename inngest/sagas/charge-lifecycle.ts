// inngest/sagas/charge-lifecycle.ts
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const chargeLifecycle = inngest.createFunction(
  {
    id: "charge-lifecycle",
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
            title: `[FALHA LIFECYCLE] Ciclo da cobrança ${data.chargeId} falhou`,
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
  { event: "charge/created" },
  async ({ event, step }) => {
    const { chargeId } = event.data;

    // Generate boleto
    await step.run("generate-boleto", async () => {
      const charge = await prisma.charge.findUnique({
        where: { id: chargeId },
        include: { boleto: true },
      });

      if (charge && !charge.boleto) {
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

    // OVERDUE transition and dunning are now handled by batch-orchestrator
    return { chargeId, result: "boleto-generated" };
  }
);
