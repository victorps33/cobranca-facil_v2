import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { decideInboundResponse } from "@/lib/agent/ai";
import { buildInboundContext } from "@/lib/agent/context-builder";
import { shouldForceEscalate, checkConsecutiveFailures } from "@/lib/agent/escalation";
import { dispatchMessage } from "@/lib/agent/dispatch";

export const inboundProcessing = inngest.createFunction(
  {
    id: "inbound-processing-saga",
    retries: 2,
    onFailure: async ({ event }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const conversationId = event.data.event.data.conversationId;
      if (conversationId) {
        await p.conversation.update({
          where: { id: conversationId },
          data: { status: "PENDENTE_HUMANO" },
        });
      }
    },
  },
  { event: "inbound/received" },
  async ({ event, step }) => {
    const { from, body, channel, customerId, conversationId, messageId, franqueadoraId } = event.data;

    // Step 1: Ensure customer and conversation exist
    const context = await step.run("ensure-context", async () => {
      let custId = customerId;
      let convId = conversationId;

      // If no customer, try to find by phone
      if (!custId) {
        const customer = await prisma.customer.findFirst({
          where: {
            OR: [
              { phone: from },
              { whatsappPhone: from },
            ],
            franqueadoraId,
          },
        });
        custId = customer?.id;
      }

      if (!custId) {
        return { skip: true, reason: "customer-not-found" };
      }

      // Find or create conversation
      if (!convId) {
        let conv = await prisma.conversation.findFirst({
          where: {
            customerId: custId,
            channel,
            status: { not: "RESOLVIDA" },
          },
        });

        if (!conv) {
          conv = await prisma.conversation.create({
            data: {
              customerId: custId,
              channel,
              status: "PENDENTE_IA",
              franqueadoraId,
            },
          });
        }

        convId = conv.id;
      }

      return { skip: false, customerId: custId, conversationId: convId };
    });

    if (context.skip) {
      return { result: "skipped", reason: (context as { skip: true; reason: string }).reason };
    }

    const { customerId: custId, conversationId: convId } = context as {
      skip: false;
      customerId: string;
      conversationId: string;
    };

    // Step 2: Build context and get AI decision
    const decision = await step.run("ai-decide-response", async () => {
      const ctx = await buildInboundContext(convId!, body);
      if (!ctx) return null;
      return decideInboundResponse(ctx);
    });

    if (!decision) {
      return { result: "ai-unavailable" };
    }

    // Step 3: Log AI decision
    await step.sendEvent("log-decision", {
      name: "ai/inbound-decided",
      data: {
        conversationId: convId!,
        customerId: custId!,
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        franqueadoraId,
      },
    });

    // Step 4: Safety checks
    const escalationCheck = await step.run("safety-check", async () => {
      const agentConfig = await prisma.agentConfig.findFirst({
        where: { franqueadoraId, enabled: true },
      });

      const forceEscalate = shouldForceEscalate(
        decision,
        body,
        {
          escalationThreshold: agentConfig?.escalationThreshold ?? 0.3,
          highValueThreshold: agentConfig?.highValueThreshold ?? 1000000,
        },
      );

      if (forceEscalate.shouldEscalate) {
        return { shouldEscalate: true as const, reason: forceEscalate.reason, details: forceEscalate.details };
      }

      // TODO: checkConsecutiveFailures is currently stubbed (returns false).
      // Refactor to use Message.metadata or Inngest run history for failure tracking.
      const consecutiveCheck = await checkConsecutiveFailures(custId!);
      if (consecutiveCheck.shouldEscalate) {
        return { shouldEscalate: true as const, reason: consecutiveCheck.reason, details: consecutiveCheck.details };
      }

      return { shouldEscalate: false as const, reason: undefined, details: undefined };
    });

    // Step 5: Execute action
    if (escalationCheck.shouldEscalate) {
      await step.sendEvent("escalate", {
        name: "ai/escalation-triggered",
        data: {
          conversationId: convId,
          customerId: custId!,
          reason: escalationCheck.reason || "SAFETY_NET",
          details: escalationCheck.details,
          franqueadoraId,
        },
      });
      return { result: "escalated", reason: escalationCheck.reason };
    }

    // Dispatch AI response
    if (decision.message) {
      await step.run("dispatch-response", async () => {
        const message = await prisma.message.create({
          data: {
            conversationId: convId!,
            sender: "AI",
            content: decision.message!,
            contentType: "text",
            channel,
          },
        });

        await dispatchMessage({
          channel,
          content: decision.message!,
          customerId: custId!,
          conversationId: convId!,
          messageId: message.id,
          franqueadoraId,
        });

        // Update conversation status
        await prisma.conversation.update({
          where: { id: convId! },
          data: { status: "ABERTA", lastMessageAt: new Date() },
        });
      });
    }

    return { result: "responded", action: decision.action };
  }
);
