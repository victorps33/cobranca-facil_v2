import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/crm/interactions — Lista interações
export async function GET(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const type = searchParams.get("type");

  try {
    const interactions = await prisma.interactionLog.findMany({
      where: {
        customer: { franqueadoraId: tenantId! },
        ...(customerId && { customerId }),
        ...(type && { type: type as any }),
      },
      include: {
        customer: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(interactions);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/crm/interactions — Criar interação
export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const body = await req.json();

    // Verify customer belongs to tenant
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, franqueadoraId: tenantId! },
    });
    if (!customer) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const interaction = await prisma.interactionLog.create({
      data: {
        customerId: body.customerId,
        chargeId: body.chargeId || null,
        type: body.type,
        direction: body.direction,
        content: body.content,
        createdById: session!.user.id,
      },
      include: {
        customer: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });
    return NextResponse.json(interaction, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao criar interação" }, { status: 500 });
  }
}
