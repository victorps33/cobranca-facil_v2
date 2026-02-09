import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/charges — Lista cobranças
export async function GET() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const charges = await prisma.charge.findMany({
      where: { customer: { franqueadoraId: tenantId! } },
      include: { customer: true, boleto: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(charges);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/charges — Criar cobrança
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
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

    const charge = await prisma.charge.create({
      data: {
        customerId: body.customerId,
        description: body.description,
        amountCents: body.amountCents,
        dueDate: new Date(body.dueDate),
        status: "PENDING",
      },
      include: { customer: true },
    });
    return NextResponse.json(charge, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao criar cobrança" }, { status: 500 });
  }
}
