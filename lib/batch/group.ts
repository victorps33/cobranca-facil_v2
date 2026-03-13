import type { Channel, DunningPhase } from "@prisma/client";

export const PHASE_SEVERITY: Record<DunningPhase, number> = {
  LEMBRETE: 0,
  VENCIMENTO: 1,
  ATRASO: 2,
  NEGATIVACAO: 3,
  COBRANCA_INTENSIVA: 4,
  PROTESTO: 5,
  POS_PROTESTO: 6,
};

interface CustomerContact {
  email: string;
  phone: string;
  whatsappPhone: string | null;
}

interface GroupableIntent {
  customerId: string;
  channel: Channel;
  phase: DunningPhase;
}

export interface IntentGroup<T extends GroupableIntent = GroupableIntent> {
  customerId: string;
  channel: Channel;
  intents: T[];
}

export function resolveRecipient(
  channel: Channel,
  customer: CustomerContact
): string | null {
  let value: string | null = null;

  switch (channel) {
    case "EMAIL":
      value = customer.email;
      break;
    case "WHATSAPP":
      value = customer.whatsappPhone || customer.phone;
      break;
    case "SMS":
      value = customer.phone;
      break;
  }

  return value && value.trim().length > 0 ? value : null;
}

export function maxPhase(phases: DunningPhase[]): DunningPhase {
  return phases.reduce((max, phase) =>
    PHASE_SEVERITY[phase] > PHASE_SEVERITY[max] ? phase : max
  );
}

export function groupIntentsByRecipient<T extends GroupableIntent>(
  intents: T[]
): IntentGroup<T>[] {
  const map = new Map<string, IntentGroup<T>>();

  for (const intent of intents) {
    const key = `${intent.customerId}:${intent.channel}`;
    if (!map.has(key)) {
      map.set(key, {
        customerId: intent.customerId,
        channel: intent.channel,
        intents: [],
      });
    }
    map.get(key)!.intents.push(intent);
  }

  return Array.from(map.values());
}
