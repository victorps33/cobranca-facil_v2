import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 500;

export const checkPendingCharges = inngest.createFunction(
  {
    id: "check-pending-charges",
    retries: 3,
    onFailure: async ({ error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      const customer = await p.customer.findFirst({ select: { id: true } });
      if (systemUser && customer) {
        await p.collectionTask.create({
          data: {
            title: "[FALHA CRON] check-pending-charges falhou",
            description: `Erro: ${error.message}`,
            priority: "CRITICA",
            status: "PENDENTE",
            customerId: customer.id,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  { cron: "0 8 * * *" },
  async ({ step }) => {
    let totalProcessed = 0;
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const batchResult = await step.run(`find-overdue-batch-${totalProcessed}`, async () => {
        const now = new Date();
        const charges = await prisma.charge.findMany({
          where: {
            status: "PENDING",
            dueDate: { lt: now },
          },
          select: {
            id: true,
            customerId: true,
            dueDate: true,
            customer: { select: { franqueadoraId: true } },
          },
          orderBy: { id: "asc" },
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });

        return {
          charges,
          lastId: charges.length > 0 ? charges[charges.length - 1].id : undefined,
          count: charges.length,
        };
      });

      if (batchResult.count === 0) {
        hasMore = false;
        break;
      }

      cursor = batchResult.lastId;
      hasMore = batchResult.count === BATCH_SIZE;

      // Mark batch as OVERDUE
      await step.run(`mark-overdue-${totalProcessed}`, async () => {
        await prisma.charge.updateMany({
          where: {
            id: { in: batchResult.charges.map((c) => c.id) },
            status: "PENDING",
          },
          data: { status: "OVERDUE" },
        });
      });

      // Emit events for this batch
      const validCharges = batchResult.charges.filter((c) => c.customer.franqueadoraId != null);
      if (validCharges.length > 0) {
        await step.sendEvent(
          `emit-overdue-${totalProcessed}`,
          validCharges.map((charge) => ({
            name: "charge/overdue" as const,
            data: {
              chargeId: charge.id,
              customerId: charge.customerId,
              daysPastDue: Math.floor(
                (Date.now() - new Date(charge.dueDate).getTime()) / (1000 * 60 * 60 * 24)
              ),
              franqueadoraId: charge.customer.franqueadoraId!,
            },
          }))
        );
      }

      totalProcessed += batchResult.count;
    }

    return { processed: totalProcessed };
  }
);
