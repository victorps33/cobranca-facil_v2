import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const evaluateVariants = inngest.createFunction(
  {
    id: "evaluate-variants",
    name: "Intelligence: Evaluate Variant Performance",
  },
  { cron: "0 4 * * *" },
  async ({ step }) => {
    const steps = await step.run("find-smart-content-steps", async () => {
      return prisma.dunningStep.findMany({
        where: { enabled: true, contentMode: "SMART" },
        include: { variants: { where: { active: true } } },
      });
    });

    let deactivated = 0;

    for (const s of steps) {
      if (s.variants.length <= 1) continue;

      await step.run(`evaluate-${s.id}`, async () => {
        const winner = s.variants.find((v) => v.isWinner);
        if (!winner || winner.sends < 200) return;

        for (const v of s.variants) {
          if (v.id === winner.id) continue;
          if (v.sends < 500) continue;

          // Deactivate if less than 50% of winner's conversion rate
          if (v.conversionRate < winner.conversionRate * 0.5) {
            await prisma.stepVariant.update({
              where: { id: v.id },
              data: { active: false },
            });
            deactivated++;
          }
        }
      });
    }

    return { stepsEvaluated: steps.length, variantsDeactivated: deactivated };
  }
);
