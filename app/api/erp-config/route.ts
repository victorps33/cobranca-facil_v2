import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";
import { ERPProvider } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/erp-config
// Returns current ERP config for the tenant (without secrets).
// ---------------------------------------------------------------------------
export async function GET() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const config = await prisma.eRPConfig.findUnique({
      where: { franqueadoraId: tenantId! },
    });

    if (!config) {
      return NextResponse.json({
        provider: "NONE",
        lastSyncAt: null,
        syncEnabled: false,
      });
    }

    return NextResponse.json({
      provider: config.provider,
      lastSyncAt: config.lastSyncAt,
      syncEnabled: config.syncEnabled,
      syncIntervalMin: config.syncIntervalMin,
      hasOmieCredentials: !!(config.omieAppKey && config.omieAppSecret),
      hasContaAzulCredentials: !!(
        config.contaAzulClientId && config.contaAzulAccessToken
      ),
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao buscar configuração ERP" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/erp-config
// Create or update (upsert) ERP config for the tenant.
// Body: { provider, omieAppKey?, omieAppSecret?, ... }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const body = await req.json();
    const { provider } = body;

    // Validate provider
    if (!provider || !["OMIE", "CONTA_AZUL", "NONE"].includes(provider)) {
      return NextResponse.json(
        { error: "Provider deve ser OMIE, CONTA_AZUL ou NONE" },
        { status: 400 }
      );
    }

    // If OMIE, appKey and appSecret are required
    if (provider === ERPProvider.OMIE) {
      if (!body.omieAppKey?.trim() || !body.omieAppSecret?.trim()) {
        return NextResponse.json(
          { error: "omieAppKey e omieAppSecret são obrigatórios para o provider OMIE" },
          { status: 400 }
        );
      }
    }

    // Build data based on provider
    let data: Record<string, unknown>;

    if (provider === ERPProvider.NONE) {
      // Clear all credentials and disable sync
      data = {
        provider: ERPProvider.NONE,
        omieAppKey: null,
        omieAppSecret: null,
        contaAzulClientId: null,
        contaAzulClientSecret: null,
        contaAzulAccessToken: null,
        contaAzulRefreshToken: null,
        contaAzulTokenExpiresAt: null,
        syncEnabled: false,
      };
    } else if (provider === ERPProvider.OMIE) {
      data = {
        provider: ERPProvider.OMIE,
        omieAppKey: body.omieAppKey.trim(),
        omieAppSecret: body.omieAppSecret.trim(),
        syncEnabled: body.syncEnabled ?? true,
        syncIntervalMin: body.syncIntervalMin ?? 10,
      };
    } else {
      // CONTA_AZUL
      data = {
        provider: ERPProvider.CONTA_AZUL,
        contaAzulClientId: body.contaAzulClientId ?? null,
        contaAzulClientSecret: body.contaAzulClientSecret ?? null,
        contaAzulAccessToken: body.contaAzulAccessToken ?? null,
        contaAzulRefreshToken: body.contaAzulRefreshToken ?? null,
        contaAzulTokenExpiresAt: body.contaAzulTokenExpiresAt
          ? new Date(body.contaAzulTokenExpiresAt)
          : null,
        syncEnabled: body.syncEnabled ?? true,
        syncIntervalMin: body.syncIntervalMin ?? 10,
      };
    }

    const config = await prisma.eRPConfig.upsert({
      where: { franqueadoraId: tenantId! },
      create: { franqueadoraId: tenantId!, ...data },
      update: data,
    });

    return NextResponse.json({
      provider: config.provider,
      lastSyncAt: config.lastSyncAt,
      syncEnabled: config.syncEnabled,
      syncIntervalMin: config.syncIntervalMin,
      hasOmieCredentials: !!(config.omieAppKey && config.omieAppSecret),
      hasContaAzulCredentials: !!(
        config.contaAzulClientId && config.contaAzulAccessToken
      ),
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao salvar configuração ERP" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/erp-config
// Partial update — primarily used for disconnect (set provider to NONE).
// Body: { provider?: "NONE", syncEnabled?, syncIntervalMin? }
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const body = await req.json();

    const updateData: Record<string, unknown> = {};

    if (body.provider !== undefined) {
      if (!["OMIE", "CONTA_AZUL", "NONE"].includes(body.provider)) {
        return NextResponse.json(
          { error: "Provider deve ser OMIE, CONTA_AZUL ou NONE" },
          { status: 400 }
        );
      }

      updateData.provider = body.provider as ERPProvider;

      // If switching to NONE, clear credentials and disable sync
      if (body.provider === ERPProvider.NONE) {
        updateData.omieAppKey = null;
        updateData.omieAppSecret = null;
        updateData.contaAzulClientId = null;
        updateData.contaAzulClientSecret = null;
        updateData.contaAzulAccessToken = null;
        updateData.contaAzulRefreshToken = null;
        updateData.contaAzulTokenExpiresAt = null;
        updateData.syncEnabled = false;
      }
    }

    if (body.syncEnabled !== undefined) {
      updateData.syncEnabled = body.syncEnabled;
    }

    if (body.syncIntervalMin !== undefined) {
      updateData.syncIntervalMin = body.syncIntervalMin;
    }

    const config = await prisma.eRPConfig.update({
      where: { franqueadoraId: tenantId! },
      data: updateData,
    });

    return NextResponse.json({
      provider: config.provider,
      lastSyncAt: config.lastSyncAt,
      syncEnabled: config.syncEnabled,
      syncIntervalMin: config.syncIntervalMin,
      hasOmieCredentials: !!(config.omieAppKey && config.omieAppSecret),
      hasContaAzulCredentials: !!(
        config.contaAzulClientId && config.contaAzulAccessToken
      ),
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao atualizar configuração ERP" },
      { status: 500 }
    );
  }
}
