import { prisma } from "@/lib/prisma";
import { sendWhatsApp, sendSms } from "./providers/twilio";
import { sendRawEmail } from "./providers/customerio";
import { createInteractionLog } from "@/lib/inbox/sync";
import type { MessageQueue } from "@prisma/client";
import type { DispatchResult, WorkingHours } from "./types";

export function isWithinWorkingHours(config: WorkingHours): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    hour: "numeric",
    hour12: false,
  });
  const currentHour = parseInt(formatter.format(now), 10);
  return currentHour >= config.start && currentHour < config.end;
}

export async function dispatchMessage(
  queueItem: MessageQueue
): Promise<DispatchResult> {
  // Mark as processing
  await prisma.messageQueue.update({
    where: { id: queueItem.id },
    data: { status: "PROCESSING", lastAttemptAt: new Date() },
  });

  let result: DispatchResult;

  // Route by channel
  const customer = await prisma.customer.findUnique({
    where: { id: queueItem.customerId },
  });

  if (!customer) {
    result = { success: false, error: "Cliente não encontrado" };
  } else {
    switch (queueItem.channel) {
      case "WHATSAPP":
        result = await sendWhatsApp(
          customer.whatsappPhone || customer.phone,
          queueItem.content
        );
        break;
      case "SMS":
        result = await sendSms(customer.phone, queueItem.content);
        break;
      case "EMAIL":
        result = await sendRawEmail(
          customer.email,
          "Notificação de cobrança",
          queueItem.content
        );
        break;
      default:
        result = { success: false, error: `Canal não suportado: ${queueItem.channel}` };
    }
  }

  if (result.success) {
    // Update queue status
    await prisma.messageQueue.update({
      where: { id: queueItem.id },
      data: {
        status: "SENT",
        providerMsgId: result.providerMsgId,
        sentAt: new Date(),
      },
    });

    // Create InteractionLog (skip if already created by inbox handler)
    if (customer) {
      const recentLog = await prisma.interactionLog.findFirst({
        where: {
          customerId: queueItem.customerId,
          direction: "OUTBOUND",
          content: queueItem.content,
          createdAt: { gte: new Date(Date.now() - 60000) },
        },
      });
      if (!recentLog) {
        await createInteractionLog({
          customerId: queueItem.customerId,
          chargeId: queueItem.chargeId,
          channel: queueItem.channel,
          content: queueItem.content,
          direction: "OUTBOUND",
          franqueadoraId: queueItem.franqueadoraId,
        });
      }
    }

    // Create/update Message in Conversation (skip if already created by inbox handler)
    if (queueItem.conversationId) {
      const existingMessage = await prisma.message.findFirst({
        where: {
          conversationId: queueItem.conversationId,
          content: queueItem.content,
          createdAt: { gte: new Date(Date.now() - 60000) },
        },
      });

      if (existingMessage) {
        await prisma.message.update({
          where: { id: existingMessage.id },
          data: { externalId: result.providerMsgId },
        });
      } else {
        await prisma.message.create({
          data: {
            conversationId: queueItem.conversationId,
            sender: "AI",
            content: queueItem.content,
            contentType: "text",
            channel: queueItem.channel,
            externalId: result.providerMsgId,
          },
        });
      }

      await prisma.conversation.update({
        where: { id: queueItem.conversationId },
        data: { lastMessageAt: new Date() },
      });
    }
  } else {
    // Handle failure
    const newAttemptCount = queueItem.attemptCount + 1;
    const isFinal = newAttemptCount >= queueItem.maxAttempts;

    await prisma.messageQueue.update({
      where: { id: queueItem.id },
      data: {
        status: isFinal ? "DEAD_LETTER" : "FAILED",
        attemptCount: newAttemptCount,
        lastError: result.error,
      },
    });

    // If dead letter, create task for human review
    if (isFinal) {
      const systemUser = await prisma.user.findFirst({
        where: { franqueadoraId: queueItem.franqueadoraId, role: "ADMINISTRADOR" },
      });

      if (systemUser) {
        await prisma.collectionTask.create({
          data: {
            customerId: queueItem.customerId,
            chargeId: queueItem.chargeId,
            title: `[FALHA ENVIO] Mensagem não entregue após ${queueItem.maxAttempts} tentativas`,
            description: `Canal: ${queueItem.channel}\nÚltimo erro: ${result.error}\nConteúdo: ${queueItem.content.slice(0, 500)}`,
            status: "PENDENTE",
            priority: "ALTA",
            createdById: systemUser.id,
          },
        });
      }
    }
  }

  return result;
}

export async function processPendingQueue(
  batchSize: number = 50
): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date();

  const items = await prisma.messageQueue.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      scheduledFor: { lte: now },
      attemptCount: { lt: 3 },
    },
    orderBy: [{ priority: "desc" }, { scheduledFor: "asc" }],
    take: batchSize,
  });

  let sent = 0;
  let failed = 0;

  for (const item of items) {
    // Check working hours per tenant
    const config = await prisma.agentConfig.findUnique({
      where: { franqueadoraId: item.franqueadoraId },
    });

    const workingHours: WorkingHours = {
      start: config?.workingHoursStart ?? 8,
      end: config?.workingHoursEnd ?? 20,
      timezone: config?.timezone ?? "America/Sao_Paulo",
    };

    if (!isWithinWorkingHours(workingHours)) {
      continue;
    }

    const result = await dispatchMessage(item);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { processed: items.length, sent, failed };
}
