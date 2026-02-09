import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/charges/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const charge = await prisma.charge.findFirst({
      where: { id: params.id, customer: { franqueadoraId: tenantId! } },
      include: { customer: true, boleto: true, notificationLogs: true },
    });
    if (!charge) return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
    return NextResponse.json(charge);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar cobrança" }, { status: 500 });
  }
}

// PATCH /api/charges/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const existing = await prisma.charge.findFirst({
      where: { id: params.id, customer: { franqueadoraId: tenantId! } },
    });
    if (!existing) return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });

    const body = await req.json();
    const charge = await prisma.charge.update({
      where: { id: params.id },
      data: body,
      include: { customer: true },
    });
    return NextResponse.json(charge);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar cobrança" }, { status: 500 });
  }
}

// DELETE /api/charges/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const existing = await prisma.charge.findFirst({
      where: { id: params.id, customer: { franqueadoraId: tenantId! } },
    });
    if (!existing) return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });

    await prisma.charge.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir cobrança" }, { status: 500 });
  }
}
