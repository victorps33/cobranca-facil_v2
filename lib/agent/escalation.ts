import { prisma } from "@/lib/prisma";
import type { AIDecision } from "./types";
import type { EscalationReason } from "@prisma/client";

const DANGEROUS_KEYWORDS = [
  "procon",
  "advogado",
  "processo",
  "justiça",
  "justica",
  "reclame aqui",
  "reclameaqui",
  "denúncia",
  "denuncia",
  "tribunal",
  "juizado",
  "defensoria",
  "ministério público",
  "ministerio publico",
];

const EXPLICIT_HUMAN_KEYWORDS = [
  "atendente",
  "humano",
  "gerente",
  "supervisor",
  "pessoa real",
  "falar com alguém",
  "falar com alguem",
  "quero falar",
];

interface EscalationCheck {
  shouldEscalate: boolean;
  reason?: EscalationReason;
  details?: string;
}

export function shouldForceEscalate(
  decision: AIDecision,
  inboundMessage: string | null,
  config: {
    escalationThreshold: number;
    highValueThreshold: number;
  },
  chargeAmountCents?: number
): EscalationCheck {
  // 1. Low confidence
  if (decision.confidence < config.escalationThreshold) {
    return {
      shouldEscalate: true,
      reason: "AI_UNCERTAINTY",
      details: `Confiança ${(decision.confidence * 100).toFixed(0)}% abaixo do limiar ${(config.escalationThreshold * 100).toFixed(0)}%`,
    };
  }

  // 2. High value
  if (chargeAmountCents && chargeAmountCents > config.highValueThreshold) {
    return {
      shouldEscalate: true,
      reason: "HIGH_VALUE",
      details: `Valor da cobrança (${chargeAmountCents}) acima do limiar (${config.highValueThreshold})`,
    };
  }

  // 3. Dangerous keywords in inbound message
  if (inboundMessage) {
    const lower = inboundMessage.toLowerCase();

    for (const kw of DANGEROUS_KEYWORDS) {
      if (lower.includes(kw)) {
        return {
          shouldEscalate: true,
          reason: "LEGAL_THREAT",
          details: `Palavra-chave detectada: "${kw}"`,
        };
      }
    }

    // 4. Explicit human request
    for (const kw of EXPLICIT_HUMAN_KEYWORDS) {
      if (lower.includes(kw)) {
        return {
          shouldEscalate: true,
          reason: "EXPLICIT_REQUEST",
          details: `Pedido explícito detectado: "${kw}"`,
        };
      }
    }
  }

  return { shouldEscalate: false };
}

export async function checkConsecutiveFailures(
  customerId: string,
  threshold: number = 3
): Promise<EscalationCheck> {
  const recentQueue = await prisma.messageQueue.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: threshold,
  });

  if (recentQueue.length >= threshold) {
    const allFailed = recentQueue.every(
      (q) => q.status === "FAILED" || q.status === "DEAD_LETTER"
    );
    if (allFailed) {
      return {
        shouldEscalate: true,
        reason: "REPEATED_FAILURE",
        details: `${threshold} falhas consecutivas de entrega`,
      };
    }
  }

  return { shouldEscalate: false };
}

export async function executeEscalation(
  conversationId: string,
  customerId: string,
  reason: EscalationReason,
  details: string,
  franqueadoraId: string
): Promise<void> {
  // 1. Update conversation status
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "PENDENTE_HUMANO" },
  });

  // 2. Create critical task
  const systemUser = await prisma.user.findFirst({
    where: { franqueadoraId, role: "ADMINISTRADOR" },
  });

  if (systemUser) {
    await prisma.collectionTask.create({
      data: {
        customerId,
        title: `[ESCALAÇÃO] ${reason}: ${details.slice(0, 100)}`,
        description: `Escalação automática da IA.\n\nMotivo: ${reason}\nDetalhes: ${details}\n\nConversation ID: ${conversationId}`,
        status: "PENDENTE",
        priority: "CRITICA",
        createdById: systemUser.id,
      },
    });
  }

  // 3. Create internal note message
  await prisma.message.create({
    data: {
      conversationId,
      sender: "SYSTEM",
      content: `⚠️ Escalação automática: ${reason}\n${details}`,
      contentType: "text",
      channel: (
        await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { channel: true },
        })
      )!.channel,
      isInternal: true,
    },
  });

  // 4. Send holding message to customer
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { channel: true },
  });

  if (conversation) {
    await prisma.message.create({
      data: {
        conversationId,
        sender: "AI",
        content:
          "Obrigada pelo contato. Vou transferir você para um especialista da nossa equipe que poderá ajudá-lo(a) melhor. Em breve alguém entrará em contato.",
        contentType: "text",
        channel: conversation.channel,
        isInternal: false,
      },
    });
  }
}
