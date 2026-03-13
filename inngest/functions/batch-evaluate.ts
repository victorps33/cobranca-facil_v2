// inngest/functions/batch-evaluate.ts
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { findNextStep, isCommunicationChannel, isEscalationChannel, isCallChannel, getEscalationType } from "@/lib/batch/evaluate";

export const batchEvaluate = inngest.createFunction(
  {
    id: "batch-evaluate",
    retries: 3,
    concurrency: [{ key: "event.data.franqueadoraId", limit: 1 }],
  },
  { event: "batch/tenant.ready" },
  async ({ event, step }) => {
    const { franqueadoraId, runDate, dryRun } = event.data;
    const runDateObj = new Date(runDate);

    // Step 1: Upsert BatchRun
    const batchRun = await step.run("upsert-batch-run", async () => {
      const existing = await prisma.batchRun.findUnique({
        where: { franqueadoraId_runDate: { franqueadoraId, runDate: runDateObj } },
      });
      if (existing && (existing.status === "COMPLETED" || existing.status === "RUNNING")) {
        return { id: existing.id, skip: true };
      }
      const run = await prisma.batchRun.upsert({
        where: { franqueadoraId_runDate: { franqueadoraId, runDate: runDateObj } },
        create: { franqueadoraId, runDate: runDateObj, status: "RUNNING", startedAt: new Date() },
        update: { status: "RUNNING", startedAt: new Date() },
      });
      return { id: run.id, skip: false };
    });

    if (batchRun.skip) return { batchRunId: batchRun.id, skipped: true };

    // Step 2: Load rules and compute max BEFORE_DUE offset
    const rulesData = await step.run("load-rules", async () => {
      const rules = await prisma.dunningRule.findMany({
        where: { franqueadoraId, active: true },
        include: { steps: { where: { enabled: true } } },
      });

      let maxBeforeDueOffset = 0;
      for (const rule of rules) {
        for (const s of rule.steps) {
          if (s.trigger === "BEFORE_DUE" && s.offsetDays > maxBeforeDueOffset) {
            maxBeforeDueOffset = s.offsetDays;
          }
        }
      }

      return { rules, maxBeforeDueOffset };
    });

    // Step 3: Load charges
    const charges = await step.run("load-charges", async () => {
      const maxDate = new Date(runDate);
      // Add maxBeforeDueOffset calendar days (generous — business days would be fewer)
      maxDate.setDate(maxDate.getDate() + rulesData.maxBeforeDueOffset + 4); // +4 for weekend buffer

      return prisma.charge.findMany({
        where: {
          customer: { franqueadoraId },
          status: { in: ["OVERDUE", "PENDING"] },
          dueDate: { lte: maxDate },
        },
        include: {
          customer: { include: { riskScore: true } },
          communicationIntents: { select: { stepId: true } },
        },
      });
    });

    // Step 4: Evaluate each charge
    const result = await step.run("evaluate-charges", async () => {
      const rulesByProfile = new Map<string, typeof rulesData.rules[0]>();
      for (const rule of rulesData.rules) {
        rulesByProfile.set(rule.riskProfile, rule);
      }

      let intentsCreated = 0;
      let escalationsCreated = 0;
      let tasksCreated = 0;

      for (const charge of charges) {
        const profile = charge.customer.riskScore?.riskProfile ?? "BOM_PAGADOR";
        const rule = rulesByProfile.get(profile);
        if (!rule) continue;

        const firedStepIds = charge.communicationIntents.map((ci) => ci.stepId);
        const nextStep = findNextStep(rule.steps, charge.dueDate, runDateObj, firedStepIds);
        if (!nextStep) continue;

        if (isCommunicationChannel(nextStep.channel)) {
          await prisma.communicationIntent.upsert({
            where: { chargeId_stepId: { chargeId: charge.id, stepId: nextStep.id } },
            create: {
              batchRunId: batchRun.id,
              chargeId: charge.id,
              customerId: charge.customerId,
              stepId: nextStep.id,
              phase: nextStep.phase,
              channel: nextStep.channel,
              offsetDays: nextStep.offsetDays,
            },
            update: {}, // no-op on conflict
          });
          intentsCreated++;
        } else if (isEscalationChannel(nextStep.channel)) {
          const escType = getEscalationType(nextStep.channel);
          if (escType) {
            await prisma.escalationTask.create({
              data: {
                chargeId: charge.id,
                type: escType,
                description: `Batch: ${nextStep.channel} para fatura ${charge.id}`,
              },
            });
            escalationsCreated++;
          }
        } else if (isCallChannel(nextStep.channel)) {
          const systemUser = await prisma.user.findFirst({
            where: { role: "ADMINISTRADOR" },
            select: { id: true },
          });
          if (systemUser) {
            await prisma.collectionTask.create({
              data: {
                customerId: charge.customerId,
                chargeId: charge.id,
                title: `Ligar para devedor: ${charge.customer.name}`,
                description: `Fase ${nextStep.phase}, fatura de ${charge.amountCents / 100}`,
                priority: "MEDIA",
                createdById: systemUser.id,
              },
            });
            tasksCreated++;
          }
        }
      }

      return { intentsCreated, escalationsCreated, tasksCreated };
    });

    // Step 5: Emit next event
    if (!dryRun) {
      await step.sendEvent("trigger-group", {
        name: "batch/evaluated" as const,
        data: { franqueadoraId, runDate, batchRunId: batchRun.id, dryRun },
      });
    }

    return { batchRunId: batchRun.id, ...result };
  }
);
