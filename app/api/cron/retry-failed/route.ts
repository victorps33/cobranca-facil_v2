import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find failed messages eligible for retry (with exponential backoff)
    const failed = await prisma.messageQueue.findMany({
      where: {
        status: "FAILED",
        attemptCount: { lt: 3 },
      },
    });

    let requeued = 0;

    for (const item of failed) {
      // Exponential backoff: 5min, 30min
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

    return NextResponse.json({ success: true, requeued });
  } catch (err) {
    console.error("[Cron] retry-failed error:", err);
    return NextResponse.json(
      { error: "Falha ao re-enfileirar" },
      { status: 500 }
    );
  }
}
