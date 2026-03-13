// inngest/scheduled/batch-orchestrator.ts
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

function todayBRT(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export const batchOrchestrator = inngest.createFunction(
  { id: "batch-orchestrator", retries: 3 },
  { cron: "0 11 * * 1-5" }, // 8h BRT (UTC-3)
  async ({ step }) => {
    const runDate = todayBRT();

    // Step 1: Transition PENDING → OVERDUE
    const transitioned = await step.run("transition-overdue", async () => {
      const result = await prisma.charge.updateMany({
        where: {
          status: "PENDING",
          dueDate: { lt: new Date(runDate) },
        },
        data: { status: "OVERDUE" },
      });
      return result.count;
    });

    // Step 2: Find active tenants
    const tenants = await step.run("load-tenants", async () => {
      const franqueadoras = await prisma.franqueadora.findMany({
        where: { dunningRules: { some: { active: true } } },
        select: { id: true },
      });
      return franqueadoras.map((f) => f.id);
    });

    // Step 3: Fan-out
    if (tenants.length > 0) {
      await step.sendEvent(
        "fan-out",
        tenants.map((franqueadoraId) => ({
          name: "batch/tenant.ready" as const,
          data: { franqueadoraId, runDate, dryRun: false },
        }))
      );
    }

    return { transitioned, tenants: tenants.length };
  }
);
