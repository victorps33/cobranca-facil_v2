import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/customers/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
      include: { charges: { orderBy: { dueDate: "desc" } } },
    });
    if (!customer) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar cliente" }, { status: 500 });
  }
}

// PATCH /api/customers/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const existing = await prisma.customer.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
    });
    if (!existing) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const body = await req.json();
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 500 });
  }
}

// DELETE /api/customers/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const existing = await prisma.customer.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
    });
    if (!existing) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    await prisma.customer.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir cliente" }, { status: 500 });
  }
}
