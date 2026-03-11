import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { decideCollectionAction } from "@/lib/agent/ai";
import { buildCollectionContext } from "@/lib/agent/context-builder";
import { dispatchMessage } from "@/lib/agent/dispatch";

export const dunningSaga = inngest.createFunction(
  {
    id: "dunning-saga",
    retries: 3,
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
        // Check for duplicate notification (idempotency)
        const existing = await step.run(`check-dup-${dunningStep.id}`, async () => {
          return prisma.notificationLog.findFirst({
            where: { chargeId, stepId: dunningStep.id },
          });
        });

        if (existing) continue; // Already sent for this step

        // Dispatch the message
        const dispatchResult = await step.run(`dispatch-${dunningStep.id}`, async () => {
          // Find or create conversation
          let conversation = await prisma.conversation.findFirst({
            where: { customerId, channel: dunningStep.channel, status: { not: "RESOLVIDA" } },
          });

          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: {
                customerId,
                channel: dunningStep.channel,
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
              content: decision.message!,
              contentType: "text",
              channel: dunningStep.channel,
            },
          });

          // Create NotificationLog for audit trail (used by buildCollectionContext)
          await prisma.notificationLog.create({
            data: {
              chargeId,
              stepId: dunningStep.id,
              channel: dunningStep.channel,
              status: "SENT",
              scheduledFor: new Date(),
              renderedMessage: decision.message!,
              metaJson: JSON.stringify({
                trigger: dunningStep.trigger,
                offsetDays: dunningStep.offsetDays,
                aiConfidence: decision.confidence,
                aiAction: decision.action,
              }),
            },
          });

          // Dispatch via provider
          return dispatchMessage({
            channel: dunningStep.channel,
            content: decision.message!,
            customerId,
            conversationId: conversation.id,
            messageId: message.id,
            franqueadoraId,
          });
        });

        if (!dispatchResult.success) {
          // Dispatch failed — Inngest will retry the step
          throw new Error(`Dispatch failed: ${dispatchResult.error}`);
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
