import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/charges — Lista cobranças enriquecidas
export async function GET() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const charges = await prisma.charge.findMany({
      where: { customer: { franqueadoraId: tenantId! } },
      include: { customer: true, boleto: true },
      orderBy: { dueDate: "desc" },
    });

    // Map to frontend-friendly format
    const enriched = charges.map((c) => {
      const today = new Date();
      const dueDate = new Date(c.dueDate);

      // Derive display status
      let displayStatus: string;
      if (c.status === "PAID") displayStatus = "Paga";
      else if (c.status === "CANCELED") displayStatus = "Cancelada";
      else if (c.status === "PARTIAL") displayStatus = "Parcial";
      else if (c.status === "OVERDUE" || (c.status === "PENDING" && dueDate < today)) displayStatus = "Vencida";
      else displayStatus = "Aberta";

      const valorPago = c.status === "PAID" ? c.amountCents : (c.amountPaidCents || 0);
      const valorAberto = c.status === "PAID" || c.status === "CANCELED" ? 0 : c.amountCents - (c.amountPaidCents || 0);

      return {
        id: c.id,
        cliente: c.customer.name,
        clienteId: c.customerId,
        categoria: c.categoria || "Serviço",
        descricao: c.description,
        dataEmissao: c.createdAt.toISOString().split("T")[0],
        dataVencimento: c.dueDate.toISOString().split("T")[0],
        dataPagamento: c.paidAt ? c.paidAt.toISOString().split("T")[0] : undefined,
        valorOriginal: c.amountCents,
        valorPago,
        valorAberto,
        formaPagamento: c.formaPagamento || "Boleto",
        status: displayStatus,
        nfEmitida: c.nfEmitida,
        competencia: c.competencia || "",
        linhaDigitavel: c.boleto?.linhaDigitavel || undefined,
        boletoUrl: c.boleto?.publicUrl || undefined,
      };
    });

    return NextResponse.json(enriched);
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

    // Derive competência from dueDate if not provided
    const dueDate = new Date(body.dueDate);
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const competencia = body.competencia || `${meses[dueDate.getMonth()]}/${dueDate.getFullYear()}`;

    const charge = await prisma.charge.create({
      data: {
        customerId: body.customerId,
        description: body.description,
        amountCents: body.amountCents,
        dueDate,
        status: "PENDING",
        categoria: body.categoria || null,
        formaPagamento: body.formaPagamento || null,
        competencia,
      },
      include: { customer: true },
    });
    return NextResponse.json(charge, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao criar cobrança" }, { status: 500 });
  }
}
