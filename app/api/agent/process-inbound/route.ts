import { NextResponse } from "next/server";
import { processInboundMessage } from "@/lib/agent/orchestrator";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { conversationId, messageId } = await request.json();

    if (!conversationId || !messageId) {
      return NextResponse.json(
        { error: "conversationId e messageId são obrigatórios" },
        { status: 400 }
      );
    }

    await processInboundMessage(conversationId, messageId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Agent] process-inbound error:", err);
    return NextResponse.json(
      { error: "Falha ao processar mensagem" },
      { status: 500 }
    );
  }
}
