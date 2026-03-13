import { inngest } from "../client";
import { calculateRiskForCustomer } from "@/lib/risk-score";
import { prisma } from "@/lib/prisma";

export const updateRiskScore = inngest.createFunction(
  {
    id: "update-risk-score",
    retries: 3,
    concurrency: [{ key: "event.data.customerId", limit: 1 }],
  },
  [
    { event: "charge/paid" },
    { event: "charge/partially-paid" },
  ],
  async ({ event }) => {
    const { customerId } = event.data;

    const result = await calculateRiskForCustomer(customerId);

    await prisma.franchiseeRiskScore.upsert({
      where: { customerId },
      create: {
        customerId,
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
      },
    });

    return { customerId, riskProfile: result.riskProfile };
  }
);
