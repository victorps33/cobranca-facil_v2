// inngest/functions/batch-send.ts
import { inngest } from "../client";
import { NonRetriableError } from "inngest";
import { prisma } from "@/lib/prisma";
import { dispatchMessage } from "@/lib/agent/dispatch";
import { shouldHalt } from "@/lib/batch/circuit-breaker";
import { renderConsolidatedMessage } from "@/lib/batch/render";
import { maxPhase, PHASE_SEVERITY } from "@/lib/batch/group";

export const batchSend = inngest.createFunction(
  {
    id: "batch-send",
    retries: 3,
    concurrency: [{ limit: 10 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const mgId = event.data.event.data.messageGroupId;
      const mg = await p.messageGroup.findUnique({
        where: { id: mgId },
        select: { customerId: true, channel: true },
      });
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (systemUser && mg) {
        await p.collectionTask.create({
          data: {
            title: `[FALHA BATCH] Envio falhou após retries`,
            description: `MessageGroup ${mgId}, canal ${mg.channel}, erro: ${error.message}`,
            priority: "CRITICA",
            status: "PENDENTE",
            customerId: mg.customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  { event: "batch/group.ready" },
  async ({ event, step }) => {
    const { messageGroupId, batchRunId } = event.data;

    const result = await step.run("send", async () => {
      // 1. Load group (include step for re-render)
      const group = await prisma.messageGroup.findUnique({
        where: { id: messageGroupId },
        include: {
          intents: {
            include: {
              charge: { include: { boleto: true } },
              step: { include: { variants: { where: { isWinner: true }, take: 1 } } },
            },
          },
          customer: true,
          batchRun: { select: { runDate: true } },
        },
      });

      if (!group || group.status !== "READY") {
        return { status: "skipped", reason: "not-ready" };
      }

      // 2. Circuit breaker (NonRetriableError avoids wasted retries)
      const stats = await prisma.messageGroup.groupBy({
        by: ["status"],
        where: { batchRunId },
        _count: true,
      });
      const total = stats.reduce((sum, s) => sum + s._count, 0);
      const failed = stats.find((s) => s.status === "FAILED")?._count ?? 0;

      if (shouldHalt({ total, failed })) {
        await prisma.batchRun.update({
          where: { id: batchRunId },
          data: { status: "FAILED" },
        });
        throw new NonRetriableError("Circuit breaker: failure rate exceeded 20%");
      }

      // 3. Freshness check
      const activeIntents = [];
      for (const intent of group.intents) {
        const fresh = await prisma.charge.findUnique({
          where: { id: intent.chargeId },
          select: { status: true },
        });
        if (fresh && fresh.status !== "PAID" && fresh.status !== "CANCELED") {
          activeIntents.push(intent);
        } else {
          await prisma.communicationIntent.update({
            where: { id: intent.id },
            data: { status: "SKIPPED" },
          });
        }
      }

      if (activeIntents.length === 0) {
        await prisma.messageGroup.update({
          where: { id: messageGroupId },
          data: { status: "SKIPPED" },
        });
        return { status: "skipped", reason: "all-paid" };
      }

      // Re-render if some charges were removed (use step template, not rendered message)
      let message = group.renderedMessage!;
      if (activeIntents.length !== group.intents.length) {
        const charges = activeIntents.map((i) => ({
          description: i.charge.description,
          amountCents: i.charge.amountCents,
          dueDate: i.charge.dueDate,
          boleto: i.charge.boleto,
        }));
        const phases = activeIntents.map((i) => i.phase);
        // Pick template from the most severe intent's step
        const primaryIntent = activeIntents.reduce((max, i) =>
          PHASE_SEVERITY[i.phase] >= PHASE_SEVERITY[max.phase] ? i : max
        );
        const winnerVariant = primaryIntent.step.variants?.[0];
        const template = winnerVariant?.template ?? primaryIntent.step.template;
        message = renderConsolidatedMessage(
          group.channel,
          maxPhase(phases),
          group.customer,
          charges,
          template,
          group.batchRun.runDate
        );
      }

      // 4. Create conversation + message
      let conversation = await prisma.conversation.findFirst({
        where: { customerId: group.customerId, channel: group.channel, status: { not: "RESOLVIDA" } },
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            customerId: group.customerId,
            channel: group.channel,
            status: "ABERTA",
            franqueadoraId: group.franqueadoraId,
          },
        });
      }

      const msg = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender: "SYSTEM",
          content: message,
          contentType: "text",
          channel: group.channel,
        },
      });

      // 5. Dispatch
      const dispatchResult = await dispatchMessage({
        channel: group.channel,
        content: message,
        customerId: group.customerId,
        conversationId: conversation.id,
        messageId: msg.id,
        franqueadoraId: group.franqueadoraId,
      });

      if (!dispatchResult.success) {
        throw new Error(`Dispatch failed: ${dispatchResult.error}`);
      }

      // 6. Mark success
      await prisma.messageGroup.update({
        where: { id: messageGroupId },
        data: { status: "SENT", sentAt: new Date() },
      });

      await prisma.communicationIntent.updateMany({
        where: { id: { in: activeIntents.map((i) => i.id) } },
        data: { status: "SENT" },
      });

      // 7. Create engagement event (NOT message/sent to avoid double-dispatch)
      if (group.customer.franqueadoraId) {
        await prisma.engagementEvent.create({
          data: {
            customerId: group.customerId,
            messageId: msg.id,
            channel: group.channel,
            eventType: "SENT",
            occurredAt: new Date(),
            franqueadoraId: group.customer.franqueadoraId!,
          },
        });
      }

      return { status: "sent", providerMsgId: dispatchResult.providerMsgId };
    });

    return result;
  }
);
