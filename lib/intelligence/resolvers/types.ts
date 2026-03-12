import { Channel } from "@prisma/client";

export interface ResolverContext {
  customerId: string;
  stepId: string;
  chargeId: string;
  franqueadoraId: string;
}

export interface TimingResult {
  scheduledHour: string; // "HH:MM"
  source: "manual" | "profile" | "step_stats";
}

export interface ChannelResult {
  channel: Channel;
  source: "manual" | "profile" | "step_stats";
}

export interface ContentResult {
  template: string;
  variantId: string | null;
  variantLabel: string | null;
  source: "manual" | "variant";
}

export interface StepResolution {
  timing: TimingResult;
  channel: ChannelResult;
  content: ContentResult;
}
