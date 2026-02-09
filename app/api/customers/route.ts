import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/customers — Lista clientes
export async function GET() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const customers = await prisma.customer.findMany({
      where: { franqueadoraId: tenantId! },
      include: { charges: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(customers);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/customers — Criar cliente
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const body = await req.json();
    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        doc: body.doc,
        email: body.email,
        phone: body.phone,
        franqueadoraId: tenantId!,
      },
    });
    return NextResponse.json(customer, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao criar cliente" }, { status: 500 });
  }
}
