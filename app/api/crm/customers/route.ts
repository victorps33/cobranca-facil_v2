import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import type { CrmCustomer } from "@/lib/types/crm";

function calcHealthStatus(
  inadimplencia: number
): CrmCustomer["healthStatus"] {
  if (inadimplencia <= 0.02) return "Saudável";
  if (inadimplencia <= 0.05) return "Controlado";
  if (inadimplencia <= 0.15) return "Exige Atenção";
  return "Crítico";
}

// GET /api/crm/customers — Lista enriquecida de clientes com métricas CRM
export async function GET() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const customers = await prisma.customer.findMany({
      where: { franqueadoraId: tenantId! },
      include: {
        charges: true,
        collectionTasks: {
          select: { status: true },
        },
        interactions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const result: CrmCustomer[] = customers.map((c) => {
      const totalEmitido = c.charges.reduce(
        (sum, ch) => sum + ch.amountCents,
        0
      );
      const totalRecebido = c.charges
        .filter((ch) => ch.status === "PAID")
        .reduce((sum, ch) => sum + ch.amountCents, 0);
      const totalAberto = c.charges
        .filter((ch) => ch.status === "PENDING" || ch.status === "OVERDUE")
        .reduce((sum, ch) => sum + ch.amountCents, 0);
      const totalVencido = c.charges
        .filter((ch) => ch.status === "OVERDUE")
        .reduce((sum, ch) => sum + ch.amountCents, 0);
      const qtdTarefasAbertas = c.collectionTasks.filter(
        (t) => t.status === "PENDENTE" || t.status === "EM_ANDAMENTO"
      ).length;
      const ultimaInteracao =
        c.interactions[0]?.createdAt?.toISOString() ?? null;
      const inadimplencia = totalEmitido > 0 ? totalVencido / totalEmitido : 0;

      return {
        id: c.id,
        name: c.name,
        doc: c.doc,
        email: c.email,
        phone: c.phone,
        totalEmitido,
        totalRecebido,
        totalAberto,
        totalVencido,
        qtdTarefasAbertas,
        ultimaInteracao,
        inadimplencia,
        healthStatus: calcHealthStatus(inadimplencia),
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
