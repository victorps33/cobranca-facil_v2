import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { computeStepStats } from "@/lib/intelligence/stats";

export const refreshResolverStats = inngest.createFunction(
  {
    id: "refresh-resolver-stats",
    name: "Intelligence: Refresh Step Stats",
  },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const steps = await step.run("find-smart-steps", async () => {
      return prisma.dunningStep.findMany({
        where: {
          enabled: true,
          OR: [
            { timingMode: "SMART" },
            { channelMode: "SMART" },
            { contentMode: "SMART" },
          ],
        },
        select: { id: true },
      });
    });

    for (const s of steps) {
      await step.run(`compute-${s.id}`, () => computeStepStats(s.id));
    }

    return { stepsProcessed: steps.length };
  }
);
