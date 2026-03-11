import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { recalculateAllRiskScores } from "@/lib/risk-score";

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

    const results = await step.run("recalculate-all", async () => {
      return recalculateAllRiskScores(franqueadoras.map((f) => f.id));
    });

    return { recalculated: results.length };
  }
);
