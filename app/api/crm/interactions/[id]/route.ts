import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/crm/interactions/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const interaction = await prisma.interactionLog.findFirst({
      where: {
        id: params.id,
        customer: { franqueadoraId: tenantId! },
      },
      include: {
        customer: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    if (!interaction) {
      return NextResponse.json({ error: "Interação não encontrada" }, { status: 404 });
    }

    return NextResponse.json(interaction);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar interação" }, { status: 500 });
  }
}

// DELETE /api/crm/interactions/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    // Verify interaction belongs to tenant
    const interaction = await prisma.interactionLog.findFirst({
      where: {
        id: params.id,
        customer: { franqueadoraId: tenantId! },
      },
    });

    if (!interaction) {
      return NextResponse.json({ error: "Interação não encontrada" }, { status: 404 });
    }

    await prisma.interactionLog.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao remover interação" }, { status: 500 });
  }
}
