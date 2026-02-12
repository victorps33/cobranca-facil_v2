import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/customers — Lista clientes com métricas computadas
export async function GET() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const customers = await prisma.customer.findMany({
      where: { franqueadoraId: tenantId! },
      include: { charges: true },
      orderBy: { createdAt: "desc" },
    });

    // Compute metrics for each customer
    const enriched = customers.map((customer) => {
      const charges = customer.charges;
      const valorEmitido = charges.reduce((s, c) => s + c.amountCents, 0);
      const valorRecebido = charges
        .filter((c) => c.status === "PAID")
        .reduce((s, c) => s + c.amountCents, 0);
      const valorAberto = charges
        .filter((c) => c.status === "PENDING" || c.status === "OVERDUE")
        .reduce((s, c) => s + c.amountCents, 0);
      const inadimplencia = valorEmitido > 0 ? valorAberto / valorEmitido : 0;

      // PMR: average days between creation and payment for paid charges
      const paidCharges = charges.filter((c) => c.status === "PAID" && c.paidAt);
      const pmr = paidCharges.length > 0
        ? Math.round(
            paidCharges.reduce((s, c) => {
              const created = new Date(c.createdAt).getTime();
              const paid = new Date(c.paidAt!).getTime();
              return s + (paid - created) / (1000 * 60 * 60 * 24);
            }, 0) / paidCharges.length
          )
        : 0;

      // Derive health status from inadimplência
      let status: string;
      if (inadimplencia <= 0.05) status = "Saudável";
      else if (inadimplencia <= 0.15) status = "Controlado";
      else if (inadimplencia <= 0.25) status = "Exige Atenção";
      else status = "Crítico";

      return {
        id: customer.id,
        nome: customer.name,
        razaoSocial: customer.razaoSocial || customer.name,
        cnpj: customer.doc,
        email: customer.email,
        telefone: customer.phone,
        cidade: customer.cidade || "",
        estado: customer.estado || "",
        bairro: customer.bairro || "",
        responsavel: customer.responsavel || "",
        statusLoja: customer.statusLoja || "Aberta",
        dataAbertura: customer.dataAbertura
          ? customer.dataAbertura.toISOString().split("T")[0]
          : customer.createdAt.toISOString().split("T")[0],
        valorEmitido,
        valorRecebido,
        valorAberto,
        inadimplencia,
        status,
        pmr,
        chargeCount: charges.length,
      };
    });

    return NextResponse.json(enriched);
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
        razaoSocial: body.razaoSocial?.trim() || null,
        cidade: body.cidade?.trim() || null,
        estado: body.estado?.trim() || null,
        bairro: body.bairro?.trim() || null,
        responsavel: body.responsavel?.trim() || null,
        statusLoja: body.statusLoja || "Aberta",
        dataAbertura: body.dataAbertura ? new Date(body.dataAbertura) : null,
        franqueadoraId: tenantId!,
      },
    });
    return NextResponse.json(customer, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao criar cliente" }, { status: 500 });
  }
}
