import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { decideCollectionAction } from "@/lib/agent/ai";
import { buildCollectionContext } from "@/lib/agent/context-builder";
import { dispatchMessage } from "@/lib/agent/dispatch";
import { resolveTiming } from "@/lib/intelligence/resolvers/timing";
import { resolveChannel } from "@/lib/intelligence/resolvers/channel";
import { resolveContent } from "@/lib/intelligence/resolvers/content";
import type { ResolverContext } from "@/lib/intelligence/resolvers/types";

export const dunningSaga = inngest.createFunction(
  {
    id: "dunning-saga",
    retries: 3,
    concurrency: [{ key: "event.data.chargeId", limit: 1 }],
    onFailure: async ({ event, error }) => {
      const chargeId = event.data.event.data.chargeId;
      const { prisma: p } = await import("@/lib/prisma");
      // Find system user for createdById (required field)
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (!systemUser) return;
      await p.collectionTask.create({
        data: {
          title: `[FALHA DUNNING] Cobrança ${chargeId}`,
          description: `Saga falhou após retries: ${error.message}`,
          priority: "CRITICA",
          status: "PENDENTE",
          customerId: event.data.event.data.customerId,
          createdById: systemUser.id,
        },
      });
    },
  },
  { event: "charge/overdue" },
  async ({ event, step }) => {
    const { chargeId, customerId, franqueadoraId } = event.data;

    // Step 1: Get applicable dunning rule and steps
    const dunningConfig = await step.run("get-dunning-rule", async () => {
      // Get customer risk profile
      const riskScore = await prisma.franchiseeRiskScore.findUnique({
        where: { customerId },
      });
      const riskProfile = riskScore?.riskProfile || "BOM_PAGADOR";

      // Find matching dunning rule
      const rule = await prisma.dunningRule.findFirst({
        where: {
          franqueadoraId,
          riskProfile,
          active: true,
        },
        include: {
          steps: {
            where: { enabled: true },
            orderBy: { offsetDays: "asc" },
          },
        },
      });

      return rule;
    });

    if (!dunningConfig || dunningConfig.steps.length === 0) {
      return { chargeId, result: "no-dunning-rule" };
    }

    // Step 2: Get agent config
    const agentConfig = await step.run("get-agent-config", async () => {
      return prisma.agentConfig.findFirst({
        where: { franqueadoraId, enabled: true },
      });
    });

    if (!agentConfig) {
      return { chargeId, result: "agent-disabled" };
    }

    // Step 3: Execute each dunning step
    for (const dunningStep of dunningConfig.steps) {
      // Wait for the step's offset (days after overdue)
      if (dunningStep.offsetDays > 0) {
        await step.sleep(`wait-step-${dunningStep.id}`, `${dunningStep.offsetDays}d`);
      }

      // Check if paid while waiting
      const currentCharge = await step.run(`check-paid-${dunningStep.id}`, async () => {
        return prisma.charge.findUnique({
          where: { id: chargeId },
          select: { status: true },
        });
      });

      if (!currentCharge || currentCharge.status === "PAID" || currentCharge.status === "CANCELED") {
        return { chargeId, result: "resolved-during-dunning", step: dunningStep.id };
      }

      // Build context and get AI decision
      const decision = await step.run(`ai-decide-${dunningStep.id}`, async () => {
        const ctx = await buildCollectionContext(chargeId, dunningStep.channel as "EMAIL" | "SMS" | "WHATSAPP");
        if (!ctx) return null;
        return decideCollectionAction(ctx, agentConfig?.systemPromptOverride);
      });

      if (!decision) {
        continue; // AI unavailable, skip this step
      }

      // Log the decision
      await step.sendEvent(`log-decision-${dunningStep.id}`, {
        name: "ai/collection-decided",
        data: {
          chargeId,
          customerId,
          action: decision.action,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          franqueadoraId,
        },
      });

      // Execute based on decision
      if (decision.action === "SKIP") {
        continue;
      }

      // Handle negotiation-related actions
      if (decision.action === "NEGOTIATE" || decision.action === "MARK_PROMISE" || decision.action === "SCHEDULE_CALLBACK") {
        await step.sendEvent(`negotiation-${dunningStep.id}`, {
          name: decision.action === "NEGOTIATE" ? "negotiation/offered" as const
            : decision.action === "MARK_PROMISE" ? "negotiation/promise-made" as const
            : "negotiation/callback-scheduled" as const,
          data: {
            chargeId,
            customerId,
            franqueadoraId,
            details: decision.reasoning,
          },
        });
        // Still dispatch the message if one was generated
        if (!decision.message) continue;
      }

      if (decision.action === "ESCALATE_HUMAN") {
        await step.sendEvent(`escalate-${dunningStep.id}`, {
          name: "ai/escalation-triggered",
          data: {
            customerId,
            chargeId,
            reason: decision.escalationReason || "AI_ESCALATION",
            details: decision.reasoning,
            franqueadoraId,
          },
        });
        return { chargeId, result: "escalated", step: dunningStep.id };
      }

      if (decision.action === "SEND_COLLECTION" && decision.message) {
        // Resolve timing, channel, and content
        const resolution = await step.run(`resolve-${dunningStep.id}`, async () => {
          const resolverCtx: ResolverContext = {
            customerId,
            stepId: dunningStep.id,
            chargeId,
            franqueadoraId,
          };

          const timing = await resolveTiming({
            mode: dunningStep.timingMode,
            fallbackTime: dunningStep.fallbackTime,
            offsetDays: dunningStep.offsetDays,
          }, resolverCtx);

          const channel = await resolveChannel({
            mode: dunningStep.channelMode,
            fixedChannel: dunningStep.channel,
            allowedChannels: dunningStep.allowedChannels,
          }, resolverCtx);

          const content = await resolveContent({
            mode: dunningStep.contentMode,
            fixedTemplate: dunningStep.template,
            optimizeFor: dunningStep.optimizeFor,
            stepId: dunningStep.id,
          }, resolverCtx);

          return { timing, channel, content };
        });

        const resolvedChannel = resolution.channel.channel;
        const resolvedMessage = resolution.content.source === "variant"
          ? resolution.content.template
          : decision.message!;

        // Step A: Prepare dispatch (DB writes only)
        const prepared = await step.run(`prepare-dispatch-${dunningStep.id}`, async () => {
          // Find or create conversation
          let conversation = await prisma.conversation.findFirst({
            where: { customerId, channel: resolvedChannel, status: { not: "RESOLVIDA" } },
          });
          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: {
                customerId,
                channel: resolvedChannel,
                status: "ABERTA",
                franqueadoraId,
              },
            });
          }

          // Create message record
          const message = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              sender: "AI",
              content: resolvedMessage,
              contentType: "text",
              channel: resolvedChannel,
            },
          });

          // Upsert NotificationLog (idempotent via @@unique)
          await prisma.notificationLog.upsert({
            where: { chargeId_stepId: { chargeId, stepId: dunningStep.id } },
            create: {
              chargeId,
              stepId: dunningStep.id,
              channel: resolvedChannel,
              status: "SENT",
              scheduledFor: new Date(),
              renderedMessage: resolvedMessage,
              metaJson: JSON.stringify({
                trigger: dunningStep.trigger,
                offsetDays: dunningStep.offsetDays,
                aiConfidence: decision.confidence,
                aiAction: decision.action,
                resolvedTiming: resolution.timing,
                resolvedChannel: resolution.channel,
                variantId: resolution.content.variantId,
              }),
            },
            update: {},
          });

          return { conversationId: conversation.id, messageId: message.id };
        });

        // Step B: External dispatch (provider call only)
        const dispatchResult = await step.run(`dispatch-${dunningStep.id}`, async () => {
          return dispatchMessage({
            channel: resolvedChannel,
            content: resolvedMessage,
            customerId,
            conversationId: prepared.conversationId,
            messageId: prepared.messageId,
            franqueadoraId,
          });
        });

        if (!dispatchResult.success) {
          throw new Error(`Dispatch failed: ${dispatchResult.error}`);
        }

        // Track variant sends
        if (resolution.content.variantId) {
          await step.run(`track-variant-${dunningStep.id}`, async () => {
            await prisma.stepVariant.update({
              where: { id: resolution.content.variantId! },
              data: { sends: { increment: 1 } },
            });
          });
        }

        // Wait for delivery confirmation (optional, with timeout)
        const delivery = await step.waitForEvent(`delivery-${dunningStep.id}`, {
          event: "message/delivered",
          timeout: "24h",
          if: `async.data.providerMsgId == '${dispatchResult.providerMsgId}'`,
        });

        if (!delivery) {
          // Delivery not confirmed within 24h — continue to next step
          continue;
        }
      }
    }

    return { chargeId, result: "dunning-complete" };
  }
);
