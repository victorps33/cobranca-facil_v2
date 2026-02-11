import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processScheduledDunning } from "@/lib/agent/orchestrator";
import { processPendingQueue } from "@/lib/agent/dispatch";

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const results: {
    dunning: Record<string, { queued: number; skipped: number; errors: number }>;
    dispatch: { processed: number; sent: number; failed: number };
    retry: { requeued: number };
  } = {
    dunning: {},
    dispatch: { processed: 0, sent: 0, failed: 0 },
    retry: { requeued: 0 },
  };

  // Step 1: Process scheduled dunning for all enabled tenants
  try {
    const configs = await prisma.agentConfig.findMany({
      where: { enabled: true },
      select: { franqueadoraId: true },
    });

    for (const config of configs) {
      results.dunning[config.franqueadoraId] = await processScheduledDunning(
        config.franqueadoraId
      );
    }
  } catch (err) {
    console.error("[Cron All] dunning error:", err);
  }

  // Step 2: Retry failed messages (re-enqueue before dispatch)
  try {
    const now = new Date();

    const failed = await prisma.messageQueue.findMany({
      where: {
        status: "FAILED",
        attemptCount: { lt: 3 },
      },
    });

    let requeued = 0;

    for (const item of failed) {
      const backoffMinutes = item.attemptCount === 1 ? 5 : 30;
      const retryAfter = new Date(
        (item.lastAttemptAt?.getTime() || 0) + backoffMinutes * 60 * 1000
      );

      if (now < retryAfter) continue;

      await prisma.messageQueue.update({
        where: { id: item.id },
        data: {
          status: "PENDING",
          scheduledFor: now,
        },
      });

      requeued++;
    }

    results.retry = { requeued };
  } catch (err) {
    console.error("[Cron All] retry error:", err);
  }

  // Step 3: Dispatch pending messages
  try {
    results.dispatch = await processPendingQueue(50);
  } catch (err) {
    console.error("[Cron All] dispatch error:", err);
  }

  return NextResponse.json({ success: true, results });
}
