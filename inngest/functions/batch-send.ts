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

    // Step 1: Load group, circuit breaker, freshness check, prepare message
    const prepared = await step.run("prepare", async () => {
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
        return { skip: true as const, status: "skipped", reason: "not-ready" };
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
        throw new NonRetriableError(
          `Circuit breaker: failure rate ${failed}/${total} (${((failed / total) * 100).toFixed(1)}%) exceeded 20%`
        );
      }

      // 3. Freshness check
      const activeIntentIds: string[] = [];
      for (const intent of group.intents) {
        const fresh = await prisma.charge.findUnique({
          where: { id: intent.chargeId },
          select: { status: true },
        });
        if (fresh && fresh.status !== "PAID" && fresh.status !== "CANCELED") {
          activeIntentIds.push(intent.id);
        } else {
          await prisma.communicationIntent.update({
            where: { id: intent.id },
            data: { status: "SKIPPED" },
          });
        }
      }

      if (activeIntentIds.length === 0) {
        await prisma.messageGroup.update({
          where: { id: messageGroupId },
          data: { status: "SKIPPED" },
        });
        return { skip: true as const, status: "skipped", reason: "all-paid" };
      }

      // Re-render if some charges were removed (use step template, not rendered message)
      const activeIntents = group.intents.filter((i) => activeIntentIds.includes(i.id));
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

      return {
        skip: false as const,
        message,
        channel: group.channel,
        customerId: group.customerId,
        franqueadoraId: group.franqueadoraId,
        activeIntentIds,
      };
    });

    if (prepared.skip) {
      return { status: prepared.status, reason: prepared.reason };
    }

    // Step 2: Create conversation + message + dispatch (retry-safe: if this succeeds, step 3 is safe)
    const dispatched = await step.run("dispatch", async () => {
      // Find or create conversation
      let conversation = await prisma.conversation.findFirst({
        where: { customerId: prepared.customerId, channel: prepared.channel, status: { not: "RESOLVIDA" } },
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            customerId: prepared.customerId,
            channel: prepared.channel,
            status: "ABERTA",
            franqueadoraId: prepared.franqueadoraId,
          },
        });
      }

      const msg = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender: "SYSTEM",
          content: prepared.message,
          contentType: "text",
          channel: prepared.channel,
        },
      });

      // Dispatch via Twilio/provider
      const dispatchResult = await dispatchMessage({
        channel: prepared.channel,
        content: prepared.message,
        customerId: prepared.customerId,
        conversationId: conversation.id,
        messageId: msg.id,
        franqueadoraId: prepared.franqueadoraId,
      });

      if (!dispatchResult.success) {
        throw new Error(`Dispatch failed: ${dispatchResult.error}`);
      }

      return { messageId: msg.id, providerMsgId: dispatchResult.providerMsgId };
    });

    // Step 3: Mark success + engagement event (if dispatch step succeeded, this is safe to retry)
    await step.run("finalize", async () => {
      await prisma.messageGroup.update({
        where: { id: messageGroupId },
        data: { status: "SENT", sentAt: new Date() },
      });

      await prisma.communicationIntent.updateMany({
        where: { id: { in: prepared.activeIntentIds } },
        data: { status: "SENT" },
      });

      // Create engagement event (NOT message/sent to avoid double-dispatch)
      await prisma.engagementEvent.create({
        data: {
          customerId: prepared.customerId,
          messageId: dispatched.messageId,
          channel: prepared.channel,
          eventType: "SENT",
          occurredAt: new Date(),
          franqueadoraId: prepared.franqueadoraId,
        },
      });
    });

    return { status: "sent", providerMsgId: dispatched.providerMsgId };
  }
);
