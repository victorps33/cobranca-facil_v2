import { prisma } from "@/lib/prisma";
import { Channel } from "@prisma/client";

export async function computeStepStats(stepId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Timing: group READ events by hour
  const readEvents = await prisma.engagementEvent.findMany({
    where: {
      stepId,
      eventType: "READ",
      occurredAt: { gte: thirtyDaysAgo },
    },
    select: { occurredAt: true },
  });

  let bestHourStart: string | null = null;
  let bestHourEnd: string | null = null;
  let timingLift = 0;

  if (readEvents.length >= 50) {
    const hourBuckets: Record<number, number> = {};
    for (const event of readEvents) {
      const hour = event.occurredAt.getHours();
      hourBuckets[hour] = (hourBuckets[hour] || 0) + 1;
    }

    const bestHour = Object.entries(hourBuckets).sort(
      ([, a], [, b]) => b - a
    )[0];

    if (bestHour) {
      const hour = parseInt(bestHour[0]);
      bestHourStart = `${hour.toString().padStart(2, "0")}:00`;
      bestHourEnd = `${(hour + 1).toString().padStart(2, "0")}:00`;
      const avgRate = readEvents.length / Object.keys(hourBuckets).length;
      timingLift =
        bestHour[1] > avgRate ? (bestHour[1] - avgRate) / avgRate : 0;
    }
  }

  // Channel: group by SENT and REPLIED
  const sentByChannel: Record<string, number> = {};
  const repliedByChannel: Record<string, number> = {};

  const sentEvents = await prisma.engagementEvent.groupBy({
    by: ["channel"],
    where: { stepId, eventType: "SENT", occurredAt: { gte: thirtyDaysAgo } },
    _count: true,
  });

  const replyEvents = await prisma.engagementEvent.groupBy({
    by: ["channel"],
    where: {
      stepId,
      eventType: "REPLIED",
      occurredAt: { gte: thirtyDaysAgo },
    },
    _count: true,
  });

  for (const e of sentEvents) sentByChannel[e.channel] = e._count;
  for (const e of replyEvents) repliedByChannel[e.channel] = e._count;

  const channelRates: Record<string, number> = {};
  let bestChannel: Channel | null = null;
  let bestRate = 0;

  for (const ch of Object.keys(sentByChannel)) {
    const sent = sentByChannel[ch] || 0;
    const replied = repliedByChannel[ch] || 0;
    const rate = sent > 0 ? replied / sent : 0;
    channelRates[ch] = Math.round(rate * 100) / 100;

    if (rate > bestRate) {
      bestRate = rate;
      bestChannel = ch as Channel;
    }
  }

  // Variant stats
  const variants = await prisma.stepVariant.findMany({
    where: { stepId, active: true },
  });

  let winnerVariantId: string | null = null;
  let bestConversion = 0;

  for (const v of variants) {
    if (v.conversionRate > bestConversion && v.sends >= 50) {
      bestConversion = v.conversionRate;
      winnerVariantId = v.id;
    }
  }

  // Update winner flag
  if (winnerVariantId) {
    await prisma.stepVariant.updateMany({
      where: { stepId },
      data: { isWinner: false },
    });
    await prisma.stepVariant.update({
      where: { id: winnerVariantId },
      data: { isWinner: true },
    });
  }

  await prisma.stepResolverStats.upsert({
    where: { stepId },
    create: {
      stepId,
      bestHourStart,
      bestHourEnd,
      timingLift,
      timingSamples: readEvents.length,
      timingConfidence: Math.min(readEvents.length / 500, 1),
      bestChannel,
      channelRates,
      channelLift: bestRate > 0 ? bestRate : null,
      channelSamples: sentEvents.reduce((s, e) => s + e._count, 0),
      channelConfidence: Math.min(
        sentEvents.reduce((s, e) => s + e._count, 0) / 500,
        1
      ),
      winnerVariantId,
      contentSamples: variants.reduce((s, v) => s + v.sends, 0),
      contentConfidence: winnerVariantId
        ? Math.min(variants.reduce((s, v) => s + v.sends, 0) / 1000, 1)
        : 0,
    },
    update: {
      bestHourStart,
      bestHourEnd,
      timingLift,
      timingSamples: readEvents.length,
      timingConfidence: Math.min(readEvents.length / 500, 1),
      bestChannel,
      channelRates,
      channelLift: bestRate > 0 ? bestRate : null,
      channelSamples: sentEvents.reduce((s, e) => s + e._count, 0),
      channelConfidence: Math.min(
        sentEvents.reduce((s, e) => s + e._count, 0) / 500,
        1
      ),
      winnerVariantId,
      contentSamples: variants.reduce((s, v) => s + v.sends, 0),
      contentConfidence: winnerVariantId
        ? Math.min(variants.reduce((s, v) => s + v.sends, 0) / 1000, 1)
        : 0,
    },
  });
}

export async function computeCustomerProfile(customerId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const events = await prisma.engagementEvent.findMany({
    where: {
      customerId,
      occurredAt: { gte: thirtyDaysAgo },
    },
    select: { eventType: true, channel: true, occurredAt: true },
  });

  if (events.length === 0) return;

  // Best hour
  const readEvents = events.filter((e) => e.eventType === "READ");
  const hourCounts: Record<number, number> = {};
  for (const e of readEvents) {
    const hour = e.occurredAt.getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  const bestHourEntry = Object.entries(hourCounts).sort(
    ([, a], [, b]) => b - a
  )[0];
  const bestHour = bestHourEntry
    ? `${bestHourEntry[0].padStart(2, "0")}:00`
    : null;

  // Best channel
  const sentByChannel: Record<string, number> = {};
  const repliedByChannel: Record<string, number> = {};

  for (const e of events) {
    if (e.eventType === "SENT")
      sentByChannel[e.channel] = (sentByChannel[e.channel] || 0) + 1;
    if (e.eventType === "REPLIED")
      repliedByChannel[e.channel] = (repliedByChannel[e.channel] || 0) + 1;
  }

  let bestChannel: Channel | null = null;
  let bestRate = 0;
  const channelRates: Record<string, number> = {};

  for (const ch of Object.keys(sentByChannel)) {
    const rate =
      sentByChannel[ch] > 0
        ? (repliedByChannel[ch] || 0) / sentByChannel[ch]
        : 0;
    channelRates[ch] = Math.round(rate * 100) / 100;
    if (rate > bestRate) {
      bestRate = rate;
      bestChannel = ch as Channel;
    }
  }

  const totalMessages = events.filter((e) => e.eventType === "SENT").length;
  const totalOpens = readEvents.length;
  const totalReplies = events.filter((e) => e.eventType === "REPLIED").length;
  const totalPayments = events.filter((e) => e.eventType === "PAID").length;

  await prisma.customerEngagementProfile.upsert({
    where: { customerId },
    create: {
      customerId,
      bestHour,
      activeHours: hourCounts,
      bestChannel,
      channelRates,
      totalMessages,
      totalOpens,
      totalReplies,
      totalPayments,
      overallResponseRate:
        totalMessages > 0 ? totalReplies / totalMessages : 0,
    },
    update: {
      bestHour,
      activeHours: hourCounts,
      bestChannel,
      channelRates,
      totalMessages,
      totalOpens,
      totalReplies,
      totalPayments,
      overallResponseRate:
        totalMessages > 0 ? totalReplies / totalMessages : 0,
    },
  });
}
