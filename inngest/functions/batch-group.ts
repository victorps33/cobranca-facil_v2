// inngest/functions/batch-group.ts
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { groupIntentsByRecipient, resolveRecipient, maxPhase, PHASE_SEVERITY } from "@/lib/batch/group";
import { renderConsolidatedMessage } from "@/lib/batch/render";

export const batchGroup = inngest.createFunction(
  { id: "batch-group", retries: 3 },
  { event: "batch/evaluated" },
  async ({ event, step }) => {
    const { batchRunId, franqueadoraId, runDate, dryRun } = event.data;

    // Step 1: Load and group intents
    const groupResult = await step.run("group-intents", async () => {
      const intents = await prisma.communicationIntent.findMany({
        where: { batchRunId, status: "PENDING" },
        include: {
          customer: true,
          charge: { include: { boleto: true } },
          step: { include: { variants: { where: { isWinner: true }, take: 1 } } },
        },
      });

      if (intents.length === 0) return { groupsCreated: 0, skipped: 0 };

      const groups = groupIntentsByRecipient(intents);
      let groupsCreated = 0;
      let skipped = 0;
      const groupIds: string[] = [];

      for (const group of groups) {
        const customer = group.intents[0].customer;
        const recipient = resolveRecipient(group.channel, customer);

        if (!recipient) {
          await prisma.communicationIntent.updateMany({
            where: { id: { in: group.intents.map((i) => i.id) } },
            data: { status: "SKIPPED" },
          });
          skipped += group.intents.length;
          continue;
        }

        const phases = group.intents.map((i) => i.phase);
        const dominantPhase = maxPhase(phases);

        // Pick template from the step of the most severe intent (using severity ordering)
        const primaryIntent = group.intents.reduce((max, i) =>
          PHASE_SEVERITY[i.phase] >= PHASE_SEVERITY[max.phase] ? i : max
        );
        const winnerVariant = primaryIntent.step.variants?.[0];
        const template = winnerVariant?.template ?? primaryIntent.step.template;

        const charges = group.intents.map((i) => ({
          description: i.charge.description,
          amountCents: i.charge.amountCents,
          dueDate: i.charge.dueDate,
          boleto: i.charge.boleto,
        }));

        const renderedMessage = renderConsolidatedMessage(
          group.channel,
          dominantPhase,
          customer,
          charges,
          template,
          new Date(runDate)
        );

        const mg = await prisma.messageGroup.upsert({
          where: {
            batchRunId_customerId_channel: {
              batchRunId,
              customerId: group.customerId,
              channel: group.channel,
            },
          },
          create: {
            batchRunId,
            franqueadoraId,
            customerId: group.customerId,
            channel: group.channel,
            recipient,
            phase: dominantPhase,
            renderedMessage,
            status: "READY",
          },
          update: {},
        });

        await prisma.communicationIntent.updateMany({
          where: { id: { in: group.intents.map((i) => i.id) } },
          data: { status: "GROUPED", messageGroupId: mg.id },
        });

        groupIds.push(mg.id);
        groupsCreated++;
      }

      return { groupsCreated, skipped, groupIds };
    });

    // Step 2: Fan-out sends
    if (!dryRun && groupResult.groupIds && groupResult.groupIds.length > 0) {
      await step.sendEvent(
        "fan-out-sends",
        groupResult.groupIds.map((messageGroupId) => ({
          name: "batch/group.ready" as const,
          data: { messageGroupId, batchRunId, franqueadoraId },
        }))
      );
    }

    return groupResult;
  }
);
