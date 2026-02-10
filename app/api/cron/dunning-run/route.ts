import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processScheduledDunning } from "@/lib/agent/orchestrator";

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    // Process all tenants with agent enabled
    const configs = await prisma.agentConfig.findMany({
      where: { enabled: true },
      select: { franqueadoraId: true },
    });

    const results: Record<
      string,
      { queued: number; skipped: number; errors: number }
    > = {};

    for (const config of configs) {
      results[config.franqueadoraId] = await processScheduledDunning(
        config.franqueadoraId
      );
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("[Cron] dunning-run error:", err);
    return NextResponse.json(
      { error: "Falha ao executar dunning" },
      { status: 500 }
    );
  }
}
