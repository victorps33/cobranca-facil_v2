import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

function todayBRT(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export const batchFinalizer = inngest.createFunction(
  { id: "batch-finalizer", retries: 3 },
  { cron: "0 13 * * 1-5" }, // 10h BRT
  async ({ step }) => {
    const runDate = todayBRT();

    // Step 1: Complete batches where all groups are done
    const completed = await step.run("complete-batches", async () => {
      const runningBatches = await prisma.batchRun.findMany({
        where: { runDate: new Date(runDate), status: "RUNNING" },
      });

      let completedCount = 0;
      for (const batch of runningBatches) {
        const pendingGroups = await prisma.messageGroup.count({
          where: { batchRunId: batch.id, status: { in: ["PENDING", "READY"] } },
        });
        if (pendingGroups === 0) {
          // Compile stats via query
          const intents = await prisma.communicationIntent.groupBy({
            by: ["status"],
            where: { batchRunId: batch.id },
            _count: true,
          });
          const groups = await prisma.messageGroup.groupBy({
            by: ["status"],
            where: { batchRunId: batch.id },
            _count: true,
          });

          const stats = {
            intentsCreated: intents.reduce((sum, i) => sum + i._count, 0),
            groupsCreated: groups.reduce((sum, g) => sum + g._count, 0),
            sent: intents.find((i) => i.status === "SENT")?._count ?? 0,
            failed: intents.find((i) => i.status === "FAILED")?._count ?? 0,
            skipped: intents.find((i) => i.status === "SKIPPED")?._count ?? 0,
          };

          await prisma.batchRun.update({
            where: { id: batch.id },
            data: { status: "COMPLETED", completedAt: new Date(), stats },
          });
          completedCount++;
        }
      }
      return completedCount;
    });

    // Step 2: Alert on SLA violations
    const slaCheck = await step.run("sla-check", async () => {
      const stuck = await prisma.batchRun.findMany({
        where: { runDate: new Date(runDate), status: { in: ["PENDING", "RUNNING"] } },
        select: { franqueadoraId: true },
      });

      if (stuck.length > 0) {
        const systemUser = await prisma.user.findFirst({
          where: { role: "ADMINISTRADOR" },
          select: { id: true },
        });
        const anyCustomer = await prisma.customer.findFirst({ select: { id: true } });

        if (systemUser && anyCustomer) {
          await prisma.collectionTask.create({
            data: {
              title: "[SLA] Batch não completou em 2h",
              description: `Franqueadoras: ${stuck.map((s) => s.franqueadoraId).join(", ")}`,
              priority: "CRITICA",
              status: "PENDENTE",
              customerId: anyCustomer.id,
              createdById: systemUser.id,
            },
          });
        }
      }
      return stuck.length;
    });

    return { completed, slaViolations: slaCheck };
  }
);
