import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DUNNING_CONTEXT_TEMPLATE, INBOUND_CONTEXT_TEMPLATE } from "./prompts";
import type { CollectionContext, InboundContext } from "./types";

export async function buildCollectionContext(
  chargeId: string,
  channel: "EMAIL" | "SMS" | "WHATSAPP"
): Promise<CollectionContext | null> {
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    include: {
      customer: {
        include: {
          conversations: {
            where: { channel },
            include: {
              messages: { orderBy: { createdAt: "desc" }, take: 20 },
            },
            take: 1,
            orderBy: { lastMessageAt: "desc" },
          },
        },
      },
    },
  });

  if (!charge || !charge.customer.franqueadoraId) return null;

  const now = new Date();
  const dueDate = new Date(charge.dueDate);
  const daysOverdue = Math.max(
    0,
    Math.round((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const recentDecisions = await prisma.agentDecisionLog.findMany({
    where: { customerId: charge.customerId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const recentNotifications = await prisma.notificationLog.findMany({
    where: { chargeId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const openTasks = await prisma.collectionTask.findMany({
    where: {
      customerId: charge.customerId,
      status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
    },
    take: 5,
  });

  const conversation = charge.customer.conversations[0];
  const messages = conversation?.messages || [];

  return {
    customer: {
      id: charge.customer.id,
      name: charge.customer.name,
      email: charge.customer.email,
      phone: charge.customer.phone,
    },
    charge: {
      id: charge.id,
      description: charge.description,
      amountCents: charge.amountCents,
      dueDate: charge.dueDate,
      status: charge.status,
      daysOverdue,
    },
    channel,
    recentMessages: messages.map((m) => ({
      sender: m.sender,
      content: m.content,
      createdAt: m.createdAt,
    })),
    recentDecisions: recentDecisions.map((d) => ({
      action: d.action,
      reasoning: d.reasoning,
      createdAt: d.createdAt,
    })),
    recentNotifications: recentNotifications.map((n) => ({
      channel: n.channel,
      status: n.status,
      sentAt: n.sentAt,
      renderedMessage: n.renderedMessage,
    })),
    openTasks: openTasks.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
    })),
    franqueadoraId: charge.customer.franqueadoraId,
  };
}

export async function buildInboundContext(
  conversationId: string,
  inboundMessage: string
): Promise<InboundContext | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!conversation || !conversation.customer.franqueadoraId) return null;

  const openCharges = await prisma.charge.findMany({
    where: {
      customerId: conversation.customerId,
      status: { in: ["PENDING", "OVERDUE"] },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
  });

  const recentDecisions = await prisma.agentDecisionLog.findMany({
    where: { customerId: conversation.customerId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const openTasks = await prisma.collectionTask.findMany({
    where: {
      customerId: conversation.customerId,
      status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
    },
    take: 5,
  });

  return {
    customer: {
      id: conversation.customer.id,
      name: conversation.customer.name,
      email: conversation.customer.email,
      phone: conversation.customer.phone,
    },
    conversationId,
    channel: conversation.channel,
    inboundMessage,
    recentMessages: conversation.messages.map((m) => ({
      sender: m.sender,
      content: m.content,
      createdAt: m.createdAt,
    })),
    recentDecisions: recentDecisions.map((d) => ({
      action: d.action,
      reasoning: d.reasoning,
      createdAt: d.createdAt,
    })),
    openCharges: openCharges.map((c) => ({
      id: c.id,
      description: c.description,
      amountCents: c.amountCents,
      dueDate: c.dueDate,
      status: c.status,
    })),
    openTasks: openTasks.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
    })),
    franqueadoraId: conversation.customer.franqueadoraId,
  };
}

export function renderDunningPrompt(ctx: CollectionContext): string {
  const messagesText =
    ctx.recentMessages.length > 0
      ? ctx.recentMessages
          .map(
            (m) =>
              `[${formatDate(m.createdAt)}] ${m.sender}: ${m.content.slice(0, 200)}`
          )
          .join("\n")
      : "Nenhuma mensagem anterior.";

  const decisionsText =
    ctx.recentDecisions.length > 0
      ? ctx.recentDecisions
          .map(
            (d) =>
              `[${formatDate(d.createdAt)}] ${d.action}: ${d.reasoning.slice(0, 150)}`
          )
          .join("\n")
      : "Nenhuma decisão anterior.";

  const notificationsText =
    ctx.recentNotifications.length > 0
      ? ctx.recentNotifications
          .map(
            (n) =>
              `[${n.sentAt ? formatDate(n.sentAt) : "não enviada"}] ${n.channel} (${n.status}): ${n.renderedMessage.slice(0, 150)}`
          )
          .join("\n")
      : "Nenhuma notificação anterior.";

  const tasksText =
    ctx.openTasks.length > 0
      ? ctx.openTasks
          .map((t) => `- ${t.title} (${t.status}, ${t.priority})`)
          .join("\n")
      : "Nenhuma tarefa aberta.";

  return DUNNING_CONTEXT_TEMPLATE.replace("{{customerName}}", ctx.customer.name)
    .replace("{{customerEmail}}", ctx.customer.email)
    .replace("{{customerPhone}}", ctx.customer.phone)
    .replace("{{chargeDescription}}", ctx.charge.description)
    .replace("{{chargeAmount}}", formatCurrency(ctx.charge.amountCents))
    .replace("{{chargeDueDate}}", formatDate(ctx.charge.dueDate))
    .replace("{{chargeStatus}}", ctx.charge.status)
    .replace("{{daysOverdue}}", String(ctx.charge.daysOverdue))
    .replace("{{channel}}", ctx.channel)
    .replace("{{recentMessages}}", messagesText)
    .replace("{{recentDecisions}}", decisionsText)
    .replace("{{recentNotifications}}", notificationsText)
    .replace("{{openTasks}}", tasksText);
}

export function renderInboundPrompt(ctx: InboundContext): string {
  const messagesText =
    ctx.recentMessages.length > 0
      ? ctx.recentMessages
          .map(
            (m) =>
              `[${formatDate(m.createdAt)}] ${m.sender}: ${m.content.slice(0, 200)}`
          )
          .join("\n")
      : "Nenhuma mensagem anterior.";

  const decisionsText =
    ctx.recentDecisions.length > 0
      ? ctx.recentDecisions
          .map(
            (d) =>
              `[${formatDate(d.createdAt)}] ${d.action}: ${d.reasoning.slice(0, 150)}`
          )
          .join("\n")
      : "Nenhuma decisão anterior.";

  const chargesText =
    ctx.openCharges.length > 0
      ? ctx.openCharges
          .map(
            (c) =>
              `- ${c.description}: ${formatCurrency(c.amountCents)} (venc. ${formatDate(c.dueDate)}, ${c.status})`
          )
          .join("\n")
      : "Nenhuma cobrança em aberto.";

  const tasksText =
    ctx.openTasks.length > 0
      ? ctx.openTasks
          .map((t) => `- ${t.title} (${t.status}, ${t.priority})`)
          .join("\n")
      : "Nenhuma tarefa aberta.";

  return INBOUND_CONTEXT_TEMPLATE.replace(
    "{{customerName}}",
    ctx.customer.name
  )
    .replace("{{customerEmail}}", ctx.customer.email)
    .replace("{{customerPhone}}", ctx.customer.phone)
    .replace("{{inboundMessage}}", ctx.inboundMessage)
    .replace("{{channel}}", ctx.channel)
    .replace("{{openCharges}}", chargesText)
    .replace("{{recentMessages}}", messagesText)
    .replace("{{recentDecisions}}", decisionsText)
    .replace("{{openTasks}}", tasksText);
}
