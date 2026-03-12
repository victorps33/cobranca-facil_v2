import { NextRequest, NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/auth-helpers";
import { AUTHORIZE_URL } from "@/lib/integrations/conta-azul/client";

// GET /api/integrations/conta-azul/authorize
// Redirects admin to Conta Azul OAuth authorization page
export async function GET(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  const clientId = process.env.CONTA_AZUL_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "CONTA_AZUL_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/integrations/conta-azul/callback`;
  const scope = "sales receivables customers services";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    state: tenantId!,
  });

  return NextResponse.redirect(`${AUTHORIZE_URL}?${params.toString()}`);
}
