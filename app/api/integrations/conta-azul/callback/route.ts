import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens } from "@/lib/integrations/conta-azul/client";

// GET /api/integrations/conta-azul/callback
// Receives OAuth code, exchanges for tokens, saves to ERPConfig
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state"); // franqueadoraId
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) {
    const desc = req.nextUrl.searchParams.get("error_description") || errorParam;
    console.error("[Conta Azul Callback] OAuth error:", desc);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings?error=conta_azul_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state parameter" },
      { status: 400 }
    );
  }

  const clientId = process.env.CONTA_AZUL_CLIENT_ID;
  const clientSecret = process.env.CONTA_AZUL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Conta Azul credentials not configured" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/integrations/conta-azul/callback`;

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      redirectUri,
      clientId,
      clientSecret
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert ERPConfig for this franqueadora
    await prisma.eRPConfig.upsert({
      where: { franqueadoraId: state },
      create: {
        franqueadoraId: state,
        provider: "CONTA_AZUL",
        contaAzulClientId: clientId,
        contaAzulClientSecret: clientSecret,
        contaAzulAccessToken: tokens.access_token,
        contaAzulRefreshToken: tokens.refresh_token,
        contaAzulTokenExpiresAt: expiresAt,
        syncEnabled: true,
      },
      update: {
        provider: "CONTA_AZUL",
        contaAzulClientId: clientId,
        contaAzulClientSecret: clientSecret,
        contaAzulAccessToken: tokens.access_token,
        contaAzulRefreshToken: tokens.refresh_token,
        contaAzulTokenExpiresAt: expiresAt,
        syncEnabled: true,
      },
    });

    console.log(`[Conta Azul Callback] Tokens saved for franqueadora ${state}`);

    return NextResponse.redirect(
      `${appUrl}/settings?success=conta_azul_connected`
    );
  } catch (err) {
    console.error("[Conta Azul Callback] Token exchange failed:", err);
    return NextResponse.redirect(
      `${appUrl}/settings?error=conta_azul_token_failed`
    );
  }
}
