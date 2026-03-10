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

  const customerId = conversation.customerId;
  const franqueadoraId = conversation.customer.franqueadoraId;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [
    openCharges,
    recentDecisions,
    openTasks,
    paidCharges,
    allChargesCount,
    promiseDecisions,
    boletosRaw,
    agentConfig,
    overdueCount,
  ] = await Promise.all([
    prisma.charge.findMany({
      where: { customerId, status: { in: ["PENDING", "OVERDUE"] } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.agentDecisionLog.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.collectionTask.findMany({
      where: { customerId, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
      take: 5,
    }),
    prisma.charge.findMany({
      where: { customerId, status: "PAID", paidAt: { gte: sixMonthsAgo } },
      select: { dueDate: true, paidAt: true },
    }),
    prisma.charge.count({
      where: { customerId, createdAt: { gte: sixMonthsAgo } },
    }),
    prisma.agentDecisionLog.findMany({
      where: { customerId, action: "MARK_PROMISE" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.boleto.findMany({
      where: {
        charge: { customerId, status: { in: ["PENDING", "OVERDUE"] } },
      },
      select: { chargeId: true, linhaDigitavel: true, publicUrl: true },
    }),
    prisma.agentConfig.findUnique({
      where: { franqueadoraId },
    }),
    prisma.charge.count({
      where: { customerId, status: "OVERDUE" },
    }),
  ]);

  // Payment history
  let totalDaysLate = 0;
  let lateCount = 0;
  for (const c of paidCharges) {
    if (c.paidAt && c.paidAt > c.dueDate) {
      const daysLate = Math.round(
        (c.paidAt.getTime() - c.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalDaysLate += daysLate;
      lateCount++;
    }
  }

  const paymentHistory: import("./types").PaymentHistory = {
    totalPaid: paidCharges.length,
    totalCharges: allChargesCount,
    averageDaysLate: lateCount > 0 ? Math.round(totalDaysLate / lateCount) : 0,
    defaultRate:
      allChargesCount > 0
        ? Math.round(((overdueCount / allChargesCount) * 100) * 100) / 100
        : 0,
  };

  // Promise history
  let promisesKept = 0;
  let promisesBroken = 0;
  for (const p of promiseDecisions) {
    if (p.chargeId) {
      const charge = await prisma.charge.findUnique({
        where: { id: p.chargeId },
        select: { status: true },
      });
      if (charge?.status === "PAID") {
        promisesKept++;
      } else {
        promisesBroken++;
      }
    }
  }

  const promiseHistory: import("./types").PromiseHistory = {
    total: promiseDecisions.length,
    kept: promisesKept,
    broken: promisesBroken,
  };

  // Risk score (0-100)
  let riskPoints = 0;
  riskPoints += Math.min(paymentHistory.averageDaysLate * 2, 30);
  riskPoints += Math.min(paymentHistory.defaultRate, 30);
  riskPoints += Math.min(promiseHistory.broken * 10, 20);
  riskPoints += Math.min(overdueCount * 5, 20);
  riskPoints = Math.min(riskPoints, 100);

  const riskLabel =
    riskPoints <= 25 ? "BAIXO"
      : riskPoints <= 50 ? "MEDIO"
        : riskPoints <= 75 ? "ALTO"
          : "CRITICO";

  const riskScore: import("./types").RiskScore = { score: riskPoints, label: riskLabel };

  // Negotiation config
  const tiers = Array.isArray(agentConfig?.negotiationRules)
    ? (agentConfig.negotiationRules as unknown as import("./types").NegotiationRuleTier[])
    : [];

  const negotiationConfig: import("./types").NegotiationConfig = {
    maxInstallments: agentConfig?.maxInstallments ?? 6,
    monthlyInterestRate: agentConfig?.monthlyInterestRate ?? 0.02,
    maxCashDiscount: agentConfig?.maxCashDiscount ?? 0.10,
    minInstallmentCents: agentConfig?.minInstallmentCents ?? 5000,
    maxFirstInstallmentDays: agentConfig?.maxFirstInstallmentDays ?? 30,
    tiers,
  };

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
    franqueadoraId,
    boletos: boletosRaw.map((b) => ({
      chargeId: b.chargeId,
      linhaDigitavel: b.linhaDigitavel,
      publicUrl: b.publicUrl,
    })),
    paymentHistory,
    promiseHistory,
    riskScore,
    negotiationConfig,
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
      : "Nenhuma decisao anterior.";

  const chargesText =
    ctx.openCharges.length > 0
      ? ctx.openCharges
          .map(
            (c) =>
              `- [${c.id}] ${c.description}: ${formatCurrency(c.amountCents)} (venc. ${formatDate(c.dueDate)}, ${c.status})`
          )
          .join("\n")
      : "Nenhuma cobranca em aberto.";

  const tasksText =
    ctx.openTasks.length > 0
      ? ctx.openTasks
          .map((t) => `- ${t.title} (${t.status}, ${t.priority})`)
          .join("\n")
      : "Nenhuma tarefa aberta.";

  const boletosText =
    ctx.boletos.length > 0
      ? ctx.boletos
          .map(
            (b) =>
              `- Cobranca ${b.chargeId}: Link: ${b.publicUrl} | Linha digitavel: ${b.linhaDigitavel}`
          )
          .join("\n")
      : "Nenhum boleto disponivel.";

  const ph = ctx.paymentHistory;
  const paymentHistoryText = `Pagamentos (6 meses): ${ph.totalPaid}/${ph.totalCharges} pagos | Atraso medio: ${ph.averageDaysLate} dias | Taxa inadimplencia: ${ph.defaultRate}%`;

  const pm = ctx.promiseHistory;
  const promiseText = `Promessas: ${pm.total} total | ${pm.kept} cumpridas | ${pm.broken} quebradas`;

  const rs = ctx.riskScore;
  const riskText = `Score de Risco: ${rs.score}/100 (${rs.label})`;

  const nc = ctx.negotiationConfig;
  let negotiationText = `Regras de Negociacao:\n- Max parcelas: ${nc.maxInstallments}\n- Juros mensal: ${(nc.monthlyInterestRate * 100).toFixed(1)}%\n- Desconto max a vista: ${(nc.maxCashDiscount * 100).toFixed(0)}%\n- Parcela minima: ${formatCurrency(nc.minInstallmentCents)}\n- Prazo max 1a parcela: ${nc.maxFirstInstallmentDays} dias`;

  if (nc.tiers.length > 0) {
    negotiationText += "\n- Faixas de valor:";
    for (const tier of nc.tiers) {
      const max = tier.maxCents ? formatCurrency(tier.maxCents) : "sem limite";
      negotiationText += `\n  ${formatCurrency(tier.minCents)} a ${max}: ate ${tier.maxInstallments}x, juros ${(tier.interestRate * 100).toFixed(1)}%`;
    }
  }

  return INBOUND_CONTEXT_TEMPLATE
    .replace("{{customerName}}", ctx.customer.name)
    .replace("{{customerEmail}}", ctx.customer.email)
    .replace("{{customerPhone}}", ctx.customer.phone)
    .replace("{{inboundMessage}}", ctx.inboundMessage)
    .replace("{{channel}}", ctx.channel)
    .replace("{{openCharges}}", chargesText)
    .replace("{{recentMessages}}", messagesText)
    .replace("{{recentDecisions}}", decisionsText)
    .replace("{{openTasks}}", tasksText)
    .replace("{{boletos}}", boletosText)
    .replace("{{paymentHistory}}", paymentHistoryText)
    .replace("{{promiseHistory}}", promiseText)
    .replace("{{riskScore}}", riskText)
    .replace("{{negotiationRules}}", negotiationText);
}
