import { NextRequest, NextResponse } from "next/server";
import { syncOmieCustomers, syncOmieTitles } from "@/lib/integrations/omie";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/integrations/omie/sync
// Cron job (every 4h) or manual trigger to sync Omie data.
// Auth: Bearer token via INTERNAL_CRON_SECRET or CRON_SECRET.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const cronSecret = process.env.INTERNAL_CRON_SECRET || process.env.CRON_SECRET;

  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const franqueadoraId = process.env.OMIE_FRANQUEADORA_ID;
  if (!franqueadoraId) {
    return NextResponse.json(
      { error: "OMIE_FRANQUEADORA_ID not configured" },
      { status: 500 }
    );
  }

  console.log("[Omie Sync] Starting full sync for tenant", franqueadoraId);

  try {
    // Customers MUST sync before titles (titles reference customers)
    const customersResult = await syncOmieCustomers(franqueadoraId);
    const titlesResult = await syncOmieTitles(franqueadoraId);

    const response = {
      ok: true,
      customers: customersResult,
      titles: titlesResult,
    };

    console.log("[Omie Sync] Complete:", JSON.stringify(response));
    return NextResponse.json(response);
  } catch (err) {
    console.error("[Omie Sync] Fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron
export async function GET(req: NextRequest) {
  return POST(req);
}
