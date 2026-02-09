import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/dunning-rules/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const rule = await prisma.dunningRule.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
      include: { steps: { orderBy: { offsetDays: "asc" } } },
    });
    if (!rule) return NextResponse.json({ error: "Régua não encontrada" }, { status: 404 });
    return NextResponse.json(rule);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar régua" }, { status: 500 });
  }
}

// PATCH /api/dunning-rules/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const existing = await prisma.dunningRule.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
    });
    if (!existing) return NextResponse.json({ error: "Régua não encontrada" }, { status: 404 });

    const body = await req.json();
    const rule = await prisma.dunningRule.update({
      where: { id: params.id },
      data: body,
      include: { steps: true },
    });
    return NextResponse.json(rule);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar régua" }, { status: 500 });
  }
}

// DELETE /api/dunning-rules/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const existing = await prisma.dunningRule.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
    });
    if (!existing) return NextResponse.json({ error: "Régua não encontrada" }, { status: 404 });

    await prisma.dunningRule.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir régua" }, { status: 500 });
  }
}
