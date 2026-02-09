import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/dunning-steps/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const step = await prisma.dunningStep.findFirst({
      where: { id: params.id, rule: { franqueadoraId: tenantId! } },
      include: { rule: true },
    });
    if (!step) return NextResponse.json({ error: "Step não encontrado" }, { status: 404 });
    return NextResponse.json(step);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar step" }, { status: 500 });
  }
}

// PATCH /api/dunning-steps/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const existing = await prisma.dunningStep.findFirst({
      where: { id: params.id, rule: { franqueadoraId: tenantId! } },
    });
    if (!existing) return NextResponse.json({ error: "Step não encontrado" }, { status: 404 });

    const body = await req.json();
    const step = await prisma.dunningStep.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json(step);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar step" }, { status: 500 });
  }
}

// DELETE /api/dunning-steps/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const existing = await prisma.dunningStep.findFirst({
      where: { id: params.id, rule: { franqueadoraId: tenantId! } },
    });
    if (!existing) return NextResponse.json({ error: "Step não encontrado" }, { status: 404 });

    await prisma.dunningStep.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir step" }, { status: 500 });
  }
}
