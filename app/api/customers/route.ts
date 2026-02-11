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

    // Validação de campos obrigatórios
    const errors: string[] = [];
    if (!body.name?.trim()) errors.push("Nome é obrigatório");
    if (!body.doc?.trim()) errors.push("CPF/CNPJ é obrigatório");
    if (!body.email?.trim()) {
      errors.push("E-mail é obrigatório");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push("E-mail inválido");
    }
    if (!body.phone?.trim()) errors.push("Telefone é obrigatório");

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name: body.name.trim(),
        doc: body.doc.trim(),
        email: body.email.trim(),
        phone: body.phone.trim(),
        franqueadoraId: tenantId!,
      },
    });
    return NextResponse.json(customer, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao criar cliente" }, { status: 500 });
  }
}
