import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/auth-helpers";
import { getERPAdapter } from "@/lib/integrations/erp-factory";
import { syncFranqueadora } from "@/lib/integrations/sync-engine";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/integrations/sync
// Manual trigger for ERP sync. Uses the generic sync engine + adapter pattern,
// so it works with any configured ERP (Conta Azul, Omie, etc.).
// Auth: requires ADMINISTRADOR role.
// ---------------------------------------------------------------------------

export async function POST() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const adapter = await getERPAdapter(tenantId!);
    console.log(`[Manual Sync] Starting for tenant ${tenantId} (${adapter.provider})`);

    const result = await syncFranqueadora(tenantId!, adapter);

    console.log(`[Manual Sync] Done:`, JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Manual Sync] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
