import { prisma } from "@/lib/prisma";
import { Channel, ResolverMode } from "@prisma/client";
import { ResolverContext, ChannelResult } from "./types";

interface ChannelConfig {
  mode: ResolverMode;
  fixedChannel: Channel;
  allowedChannels: Channel[];
}

export async function resolveChannel(
  config: ChannelConfig,
  ctx: ResolverContext
): Promise<ChannelResult> {
  if (config.mode === "MANUAL") {
    return {
      channel: config.fixedChannel,
      source: "manual",
    };
  }

  const allowed =
    config.allowedChannels.length > 0
      ? config.allowedChannels
      : [config.fixedChannel];

  // SMART: check customer profile
  const profile = await prisma.customerEngagementProfile.findUnique({
    where: { customerId: ctx.customerId },
  });

  if (profile?.bestChannel && allowed.includes(profile.bestChannel)) {
    return {
      channel: profile.bestChannel,
      source: "profile",
    };
  }

  // Fallback: check step-level stats
  const stats = await prisma.stepResolverStats.findUnique({
    where: { stepId: ctx.stepId },
  });

  if (stats?.bestChannel && allowed.includes(stats.bestChannel)) {
    return {
      channel: stats.bestChannel,
      source: "step_stats",
    };
  }

  // No data — use fixed channel
  return {
    channel: config.fixedChannel,
    source: "manual",
  };
}
