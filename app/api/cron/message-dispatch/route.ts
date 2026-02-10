import { NextResponse } from "next/server";
import { processPendingQueue } from "@/lib/agent/dispatch";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await processPendingQueue(50);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[Cron] message-dispatch error:", err);
    return NextResponse.json(
      { error: "Falha ao despachar mensagens" },
      { status: 500 }
    );
  }
}
