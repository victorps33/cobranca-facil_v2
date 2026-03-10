import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

function normalizeWhatsappFrom(value: string): string {
  // If already in whatsapp:+... format, keep as-is
  if (/^whatsapp:\+\d+$/.test(value)) return value;

  // Strip the whatsapp: prefix if present, then clean
  let cleaned = value.replace(/^whatsapp:/, "").replace(/[^\d+]/g, "");

  // If starts with +, it already has country code
  if (cleaned.startsWith("+")) return `whatsapp:${cleaned}`;

  // Only add +55 for BR-length numbers (10-11 digits)
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = "55" + cleaned;
  }
  return `whatsapp:+${cleaned}`;
}

function normalizeSmsFrom(value: string): string {
  // If already in +... format, keep as-is
  if (/^\+\d+$/.test(value)) return value;

  let cleaned = value.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+")) return cleaned;

  // Only add +55 for BR-length numbers (10-11 digits)
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = "55" + cleaned;
  }
  return `+${cleaned}`;
}

export async function GET() {
  const { tenantId, error } = await requireTenant();
  if (error) return error;

  const config = await prisma.agentConfig.findUnique({
    where: { franqueadoraId: tenantId! },
    select: { whatsappFrom: true, smsFrom: true },
  });

  return NextResponse.json({
    whatsappFrom: config?.whatsappFrom ?? "",
    smsFrom: config?.smsFrom ?? "",
  });
}

export async function PUT(request: Request) {
  const { session, error: roleError } = await requireRole(["ADMINISTRADOR"]);
  if (roleError) return roleError;

  // Support group users: resolve tenant from header or session
  let tenantId = session!.user.franqueadoraId;
  if (!tenantId && session!.user.grupoFranqueadoraId) {
    const headerList = headers();
    const requestedId = headerList.get("x-franqueadora-id");
    if (requestedId && requestedId !== "all") {
      const franqueadora = await prisma.franqueadora.findFirst({
        where: { id: requestedId, grupoId: session!.user.grupoFranqueadoraId },
      });
      if (franqueadora) tenantId = franqueadora.id;
    }
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Selecione uma franqueadora antes de configurar." }, { status: 403 });
  }

  const body = await request.json();
  const { whatsappFrom, smsFrom } = body as {
    whatsappFrom?: string;
    smsFrom?: string;
  };

  const data: { whatsappFrom?: string | null; smsFrom?: string | null } = {};

  if (whatsappFrom !== undefined) {
    data.whatsappFrom = whatsappFrom.trim()
      ? normalizeWhatsappFrom(whatsappFrom.trim())
      : null;
  }

  if (smsFrom !== undefined) {
    data.smsFrom = smsFrom.trim()
      ? normalizeSmsFrom(smsFrom.trim())
      : null;
  }

  try {
    const config = await prisma.agentConfig.upsert({
      where: { franqueadoraId: tenantId },
      update: data,
      create: {
        franqueadoraId: tenantId,
        ...data,
      },
      select: { whatsappFrom: true, smsFrom: true },
    });

    return NextResponse.json({
      whatsappFrom: config.whatsappFrom ?? "",
      smsFrom: config.smsFrom ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Este número já está em uso por outra franqueadora." },
        { status: 409 }
      );
    }
    console.error("[Twilio Config] Error:", err);
    return NextResponse.json(
      { error: "Erro ao salvar configuração." },
      { status: 500 }
    );
  }
}
