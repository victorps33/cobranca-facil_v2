import { prisma } from "@/lib/prisma";
import { ResolverMode } from "@prisma/client";
import { ResolverContext, TimingResult } from "./types";

interface TimingConfig {
  mode: ResolverMode;
  fallbackTime: string | null;
  offsetDays: number;
}

export async function resolveTiming(
  config: TimingConfig,
  ctx: ResolverContext
): Promise<TimingResult> {
  if (config.mode === "MANUAL") {
    return {
      scheduledHour: config.fallbackTime || "10:00",
      source: "manual",
    };
  }

  // SMART mode: check customer profile first
  const profile = await prisma.customerEngagementProfile.findUnique({
    where: { customerId: ctx.customerId },
  });

  if (profile?.bestHour) {
    return {
      scheduledHour: profile.bestHour,
      source: "profile",
    };
  }

  // Fallback: check step-level stats
  const stats = await prisma.stepResolverStats.findUnique({
    where: { stepId: ctx.stepId },
  });

  if (stats?.bestHourStart) {
    return {
      scheduledHour: stats.bestHourStart,
      source: "step_stats",
    };
  }

  // No data yet — use fallback
  return {
    scheduledHour: config.fallbackTime || "10:00",
    source: "manual",
  };
}
