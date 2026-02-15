import { NextRequest, NextResponse } from "next/server";
import { processOmieWebhook } from "@/lib/integrations/omie";
import type { OmieWebhookPayload } from "@/lib/integrations/omie";

// ---------------------------------------------------------------------------
// POST /api/integrations/omie/webhook
// Receives real-time events from Omie ERP.
// Always returns 200 to avoid retries from Omie.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.OMIE_WEBHOOK_SECRET;
    if (secret) {
      const headerSecret = req.headers.get("x-omie-secret");
      if (headerSecret !== secret) {
        console.warn("[Omie Webhook] Invalid secret");
        return NextResponse.json({ ok: false, detail: "Unauthorized" }, { status: 200 });
      }
    }

    const body = (await req.json()) as OmieWebhookPayload;

    if (!body.topic || !body.event) {
      console.warn("[Omie Webhook] Missing topic or event in payload");
      return NextResponse.json({ ok: false, detail: "Invalid payload" }, { status: 200 });
    }

    const result = await processOmieWebhook(body);
    console.log("[Omie Webhook] Result:", result);

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("[Omie Webhook] Unhandled error:", err);
    return NextResponse.json({ ok: false, detail: "Internal error" }, { status: 200 });
  }
}
