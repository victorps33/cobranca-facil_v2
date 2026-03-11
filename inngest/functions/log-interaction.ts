import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import type { InteractionType } from "@prisma/client";

// Map Channel to InteractionType (they share EMAIL, WHATSAPP, SMS)
function channelToInteractionType(channel: string): InteractionType {
  const map: Record<string, InteractionType> = {
    EMAIL: "EMAIL",
    WHATSAPP: "WHATSAPP",
    SMS: "SMS",
    LIGACAO: "TELEFONE",
  };
  return map[channel] || "SMS";
}

export const logInteraction = inngest.createFunction(
  {
    id: "log-interaction",
    retries: 3,
    concurrency: [{ key: "event.data.customerId", limit: 1 }],
  },
  [
    { event: "message/sent" },
    { event: "inbound/received" },
  ],
  async ({ event }) => {
    const isInbound = event.name === "inbound/received";
    const customerId = event.data.customerId;

    if (!customerId) {
      return { logged: false, reason: "no customerId" };
    }

    // Find a system user to attribute the log to
    const systemUser = await prisma.user.findFirst({
      where: { role: "ADMINISTRADOR" },
      select: { id: true },
    });

    if (!systemUser) {
      return { logged: false, reason: "no system user found" };
    }

    // Idempotency: check for recent duplicate
    const content = isInbound
      ? (event.data as { body: string }).body
      : (event.data as { content: string }).content;

    const existing = await prisma.interactionLog.findFirst({
      where: {
        customerId,
        content,
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });

    if (existing) {
      return { logged: false, reason: "duplicate" };
    }

    await prisma.interactionLog.create({
      data: {
        customerId,
        chargeId: "chargeId" in event.data ? (event.data as { chargeId?: string }).chargeId : undefined,
        type: channelToInteractionType(event.data.channel),
        direction: isInbound ? "INBOUND" : "OUTBOUND",
        content,
        createdById: systemUser.id,
      },
    });

    return { logged: true };
  }
);
