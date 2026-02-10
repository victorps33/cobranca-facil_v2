import { prisma } from "@/lib/prisma";
import { getAppNow, formatCurrency, formatDate } from "@/lib/utils";
import { buildCollectionContext, buildInboundContext } from "./context-builder";
import { decideCollectionAction, decideInboundResponse } from "./ai";
import {
  shouldForceEscalate,
  checkConsecutiveFailures,
  executeEscalation,
} from "./escalation";
import type { Channel } from "@prisma/client";

export async function processScheduledDunning(
  franqueadoraId: string
): Promise<{ queued: number; skipped: number; errors: number }> {
  const config = await prisma.agentConfig.findUnique({
    where: { franqueadoraId },
  });

  if (!config?.enabled) {
    return { queued: 0, skipped: 0, errors: 0 };
  }

  const now = await getAppNow();

  // Get active dunning steps for this tenant
  const steps = await prisma.dunningStep.findMany({
    where: {
      enabled: true,
      rule: { active: true, franqueadoraId },
    },
    include: { rule: true },
  });

  // Get pending/overdue charges
  const charges = await prisma.charge.findMany({
    where: {
      status: { in: ["PENDING", "OVERDUE"] },
      customer: { franqueadoraId },
    },
    include: { customer: true },
  });

  // Check daily message limit
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.messageQueue.count({
    where: {
      franqueadoraId,
      createdAt: { gte: todayStart },
    },
  });

  let queued = 0;
  let skipped = 0;
  let errors = 0;

  for (const charge of charges) {
    if (sentToday + queued >= config.maxDailyMessages) {
      skipped += charges.length - charges.indexOf(charge);
      break;
    }

    const dueDate = new Date(charge.dueDate);
    const diffDays = Math.round(
      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Mark as overdue if needed
    if (diffDays > 0 && charge.status === "PENDING") {
      await prisma.charge.update({
        where: { id: charge.id },
        data: { status: "OVERDUE" },
      });
    }

    for (const step of steps) {
      let shouldTrigger = false;
      if (step.trigger === "BEFORE_DUE" && diffDays === -step.offsetDays)
        shouldTrigger = true;
      if (step.trigger === "ON_DUE" && diffDays === 0) shouldTrigger = true;
      if (step.trigger === "AFTER_DUE" && diffDays === step.offsetDays)
        shouldTrigger = true;

      if (!shouldTrigger) continue;

      // Check if already sent
      const existing = await prisma.notificationLog.findFirst({
        where: { chargeId: charge.id, stepId: step.id },
      });
      if (existing) continue;

      try {
        // Build context and get AI decision
        const ctx = await buildCollectionContext(charge.id, step.channel);
        if (!ctx) {
          skipped++;
          continue;
        }

        const decision = await decideCollectionAction(
          ctx,
          config.systemPromptOverride
        );

        // Log the decision
        await prisma.agentDecisionLog.create({
          data: {
            customerId: charge.customerId,
            chargeId: charge.id,
            franqueadoraId,
            action: decision.action,
            reasoning: decision.reasoning,
            confidence: decision.confidence,
            inputContext: JSON.stringify({
              chargeId: charge.id,
              step: step.id,
              channel: step.channel,
            }),
            outputMessage: decision.message,
            escalationReason: decision.escalationReason,
            executedAt: new Date(),
          },
        });

        if (decision.action === "SKIP") {
          skipped++;
          continue;
        }

        if (
          decision.action === "ESCALATE_HUMAN" &&
          decision.escalationReason
        ) {
          // Find or create conversation for escalation
          const conversation = await findOrCreateConversation(
            charge.customerId,
            franqueadoraId,
            step.channel
          );
          await executeEscalation(
            conversation.id,
            charge.customerId,
            decision.escalationReason,
            decision.reasoning,
            franqueadoraId
          );
          skipped++;
          continue;
        }

        // Find or create conversation
        const conversation = await findOrCreateConversation(
          charge.customerId,
          franqueadoraId,
          step.channel
        );

        // Enqueue the message
        await prisma.messageQueue.create({
          data: {
            chargeId: charge.id,
            customerId: charge.customerId,
            conversationId: conversation.id,
            channel: step.channel,
            content: decision.message,
            status: "PENDING",
            priority: diffDays > 0 ? 1 : 0,
            scheduledFor: now,
            franqueadoraId,
          },
        });

        // Create NotificationLog for backward compatibility
        await prisma.notificationLog.create({
          data: {
            chargeId: charge.id,
            stepId: step.id,
            channel: step.channel,
            status: "SENT",
            scheduledFor: now,
            renderedMessage: decision.message,
            metaJson: JSON.stringify({
              trigger: step.trigger,
              offsetDays: step.offsetDays,
              aiConfidence: decision.confidence,
              aiAction: decision.action,
            }),
          },
        });

        queued++;
      } catch (err) {
        console.error(
          `[Orchestrator] Error processing charge ${charge.id}:`,
          err
        );
        errors++;
      }
    }
  }

  return { queued, skipped, errors };
}

export async function processInboundMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: {
        include: { customer: true },
      },
    },
  });

  if (!message || !message.conversation.customer.franqueadoraId) return;

  const franqueadoraId = message.conversation.customer.franqueadoraId;

  const config = await prisma.agentConfig.findUnique({
    where: { franqueadoraId },
  });

  if (!config?.enabled) {
    // Mark as pending human
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "PENDENTE_HUMANO" },
    });
    return;
  }

  // Update conversation status
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "PENDENTE_IA" },
  });

  // Build context
  const ctx = await buildInboundContext(conversationId, message.content);
  if (!ctx) return;

  // Get AI decision
  const decision = await decideInboundResponse(ctx, config.systemPromptOverride);

  // Safety net: force escalation check
  const forceCheck = shouldForceEscalate(
    decision,
    message.content,
    {
      escalationThreshold: config.escalationThreshold,
      highValueThreshold: config.highValueThreshold,
    }
  );

  const failureCheck = await checkConsecutiveFailures(
    message.conversation.customerId
  );

  // Log the decision
  await prisma.agentDecisionLog.create({
    data: {
      conversationId,
      customerId: message.conversation.customerId,
      franqueadoraId,
      action: forceCheck.shouldEscalate || failureCheck.shouldEscalate
        ? "ESCALATE_HUMAN"
        : decision.action,
      reasoning:
        forceCheck.shouldEscalate
          ? `Safety net: ${forceCheck.details}`
          : failureCheck.shouldEscalate
            ? `Safety net: ${failureCheck.details}`
            : decision.reasoning,
      confidence: decision.confidence,
      inputContext: JSON.stringify({
        conversationId,
        messageId,
        inboundMessage: message.content.slice(0, 500),
      }),
      outputMessage: decision.message,
      escalationReason:
        forceCheck.shouldEscalate
          ? forceCheck.reason
          : failureCheck.shouldEscalate
            ? failureCheck.reason
            : decision.escalationReason,
      executedAt: new Date(),
    },
  });

  // Execute escalation if needed
  if (forceCheck.shouldEscalate || failureCheck.shouldEscalate) {
    const reason = forceCheck.reason || failureCheck.reason || "AI_UNCERTAINTY";
    const details =
      forceCheck.details || failureCheck.details || "Safety net triggered";
    await executeEscalation(
      conversationId,
      message.conversation.customerId,
      reason,
      details,
      franqueadoraId
    );
    return;
  }

  // Execute AI decision
  if (decision.action === "ESCALATE_HUMAN" && decision.escalationReason) {
    await executeEscalation(
      conversationId,
      message.conversation.customerId,
      decision.escalationReason,
      decision.reasoning,
      franqueadoraId
    );
    return;
  }

  if (decision.message) {
    // Enqueue response
    await prisma.messageQueue.create({
      data: {
        customerId: message.conversation.customerId,
        conversationId,
        channel: message.conversation.channel,
        content: decision.message,
        status: "PENDING",
        priority: 2,
        scheduledFor: new Date(),
        franqueadoraId,
      },
    });
  }

  // Update conversation status
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "ABERTA" },
  });
}

async function findOrCreateConversation(
  customerId: string,
  franqueadoraId: string,
  channel: Channel
) {
  const existing = await prisma.conversation.findFirst({
    where: {
      customerId,
      franqueadoraId,
      channel,
      status: { not: "RESOLVIDA" },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      customerId,
      franqueadoraId,
      channel,
      status: "ABERTA",
      lastMessageAt: new Date(),
    },
  });
}
