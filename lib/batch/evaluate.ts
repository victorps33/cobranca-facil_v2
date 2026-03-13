import type { DunningTrigger, DunningPhase, Channel } from "@prisma/client";
import { computeFireDate } from "./fire-date";

export interface EvaluableStep {
  id: string;
  trigger: DunningTrigger;
  offsetDays: number;
  channel: Channel;
  phase: DunningPhase;
}

export function findNextStep(
  steps: EvaluableStep[],
  dueDate: Date,
  runDate: Date,
  firedStepIds: string[]
): EvaluableStep | null {
  const normalizedRunDate = new Date(
    Date.UTC(runDate.getUTCFullYear(), runDate.getUTCMonth(), runDate.getUTCDate())
  );

  const stepsWithFireDate = steps.map((step) => ({
    step,
    fireDate: computeFireDate(step.trigger, step.offsetDays, dueDate),
  }));

  stepsWithFireDate.sort((a, b) => a.fireDate.getTime() - b.fireDate.getTime());

  for (const { step, fireDate } of stepsWithFireDate) {
    if (firedStepIds.includes(step.id)) continue;
    if (fireDate.getTime() <= normalizedRunDate.getTime()) {
      return step;
    }
  }

  return null;
}

const COMMUNICATION_CHANNELS: Channel[] = ["EMAIL", "SMS", "WHATSAPP"];
const ESCALATION_MAP: Partial<Record<Channel, "NEGATIVACAO" | "PROTESTO" | "JURIDICO">> = {
  BOA_VISTA: "NEGATIVACAO",
  CARTORIO: "PROTESTO",
  JURIDICO: "JURIDICO",
};

export function isCommunicationChannel(channel: Channel): boolean {
  return COMMUNICATION_CHANNELS.includes(channel);
}

export function isEscalationChannel(channel: Channel): channel is "BOA_VISTA" | "CARTORIO" | "JURIDICO" {
  return channel in ESCALATION_MAP;
}

export function getEscalationType(channel: Channel): "NEGATIVACAO" | "PROTESTO" | "JURIDICO" | null {
  return ESCALATION_MAP[channel] ?? null;
}

export function isCallChannel(channel: Channel): boolean {
  return channel === "LIGACAO";
}
