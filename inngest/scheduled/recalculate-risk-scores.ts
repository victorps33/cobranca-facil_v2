import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { calculateRiskForCustomer } from "@/lib/risk-score";

const BATCH_SIZE = 100;

export const recalculateRiskScores = inngest.createFunction(
  {
    id: "recalculate-risk-scores",
    retries: 3,
  },
  { cron: "0 2 * * 1" },
  async ({ step }) => {
    const franqueadoras = await step.run("get-franqueadoras", async () => {
      return prisma.franqueadora.findMany({
        select: { id: true },
      });
    });

    let totalRecalculated = 0;

    for (const franqueadora of franqueadoras) {
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const batchResult = await step.run(
          `recalc-${franqueadora.id}-${totalRecalculated}`,
          async () => {
            const customers = await prisma.customer.findMany({
              where: { franqueadoraId: franqueadora.id },
              select: { id: true },
              orderBy: { id: "asc" },
              take: BATCH_SIZE,
              ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            });

            let processed = 0;
            for (const customer of customers) {
              const result = await calculateRiskForCustomer(customer.id);
              await prisma.franchiseeRiskScore.upsert({
                where: { customerId: customer.id },
                create: {
                  customerId: customer.id,
                  defaultRate: result.defaultRate,
                  avgDaysLate: result.avgDaysLate,
                  totalOutstanding: result.totalOutstanding,
                  riskProfile: result.riskProfile,
                },
                update: {
                  defaultRate: result.defaultRate,
                  avgDaysLate: result.avgDaysLate,
                  totalOutstanding: result.totalOutstanding,
                  riskProfile: result.riskProfile,
                  calculatedAt: new Date(),
                },
              });
              processed++;
            }

            return {
              lastId: customers.length > 0 ? customers[customers.length - 1].id : undefined,
              count: customers.length,
              processed,
            };
          }
        );

        cursor = batchResult.lastId;
        hasMore = batchResult.count === BATCH_SIZE;
        totalRecalculated += batchResult.processed;
      }
    }

    return { recalculated: totalRecalculated };
  }
);
