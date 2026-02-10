import { prisma } from "@/lib/prisma";
import type { Channel } from "@prisma/client";

interface InteractionLogInput {
  customerId: string;
  chargeId?: string | null;
  channel: Channel;
  content: string;
  direction: "INBOUND" | "OUTBOUND";
  franqueadoraId: string;
}

function channelToInteractionType(channel: Channel) {
  switch (channel) {
    case "EMAIL":
      return "EMAIL" as const;
    case "SMS":
      return "SMS" as const;
    case "WHATSAPP":
      return "WHATSAPP" as const;
  }
}

export async function createInteractionLog(
  input: InteractionLogInput
): Promise<string | null> {
  // Find a system user for this tenant to use as createdBy
  const systemUser = await prisma.user.findFirst({
    where: { franqueadoraId: input.franqueadoraId },
    orderBy: { role: "asc" }, // Prefer ADMINISTRADOR
  });

  if (!systemUser) {
    console.warn(
      `[Sync] No user found for tenant ${input.franqueadoraId} — skipping InteractionLog`
    );
    return null;
  }

  const log = await prisma.interactionLog.create({
    data: {
      customerId: input.customerId,
      chargeId: input.chargeId,
      type: channelToInteractionType(input.channel),
      direction: input.direction,
      content: input.content,
      createdById: systemUser.id,
    },
  });

  return log.id;
}
