import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import type {
  CrmCustomer,
  CrmCharge,
  CrmInteraction,
  CrmTask,
} from "@/lib/types/crm";

function calcHealthStatus(
  inadimplencia: number
): CrmCustomer["healthStatus"] {
  if (inadimplencia <= 0.02) return "Saudável";
  if (inadimplencia <= 0.05) return "Controlado";
  if (inadimplencia <= 0.15) return "Exige Atenção";
  return "Crítico";
}

// GET /api/crm/customers/[id] — Cliente + cobranças + interações + tarefas
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
      include: {
        charges: {
          orderBy: { dueDate: "desc" },
        },
        interactions: {
          orderBy: { createdAt: "desc" },
          include: {
            createdBy: { select: { name: true } },
          },
        },
        collectionTasks: {
          orderBy: { createdAt: "desc" },
          include: {
            assignedTo: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    // Calculate metrics
    const totalEmitido = customer.charges.reduce(
      (sum, ch) => sum + ch.amountCents,
      0
    );
    const totalRecebido = customer.charges
      .filter((ch) => ch.status === "PAID")
      .reduce((sum, ch) => sum + ch.amountCents, 0);
    const totalAberto = customer.charges
      .filter((ch) => ch.status === "PENDING" || ch.status === "OVERDUE")
      .reduce((sum, ch) => sum + ch.amountCents, 0);
    const totalVencido = customer.charges
      .filter((ch) => ch.status === "OVERDUE")
      .reduce((sum, ch) => sum + ch.amountCents, 0);
    const qtdTarefasAbertas = customer.collectionTasks.filter(
      (t) => t.status === "PENDENTE" || t.status === "EM_ANDAMENTO"
    ).length;
    const ultimaInteracao =
      customer.interactions[0]?.createdAt?.toISOString() ?? null;
    const inadimplencia =
      totalEmitido > 0 ? totalVencido / totalEmitido : 0;

    const crmCustomer: CrmCustomer = {
      id: customer.id,
      name: customer.name,
      doc: customer.doc,
      email: customer.email,
      phone: customer.phone,
      totalEmitido,
      totalRecebido,
      totalAberto,
      totalVencido,
      qtdTarefasAbertas,
      ultimaInteracao,
      inadimplencia,
      healthStatus: calcHealthStatus(inadimplencia),
    };

    const charges: CrmCharge[] = customer.charges.map((ch) => ({
      id: ch.id,
      customerId: ch.customerId,
      description: ch.description,
      amountCents: ch.amountCents,
      dueDate: ch.dueDate.toISOString(),
      status: ch.status,
      createdAt: ch.createdAt.toISOString(),
    }));

    const interactions: CrmInteraction[] = customer.interactions.map((i) => ({
      id: i.id,
      customerId: i.customerId,
      customerName: customer.name,
      chargeId: i.chargeId,
      type: i.type,
      direction: i.direction,
      content: i.content,
      createdBy: i.createdBy.name ?? "Usuário",
      createdById: i.createdById,
      createdAt: i.createdAt.toISOString(),
    }));

    const tasks: CrmTask[] = customer.collectionTasks.map((t) => ({
      id: t.id,
      customerId: t.customerId,
      customerName: customer.name,
      chargeId: t.chargeId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      assignedTo: t.assignedTo?.name ?? null,
      assignedToId: t.assignedToId,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdBy: t.createdBy.name ?? "Usuário",
      createdById: t.createdById,
      createdAt: t.createdAt.toISOString(),
    }));

    return NextResponse.json({ customer: crmCustomer, charges, interactions, tasks });
  } catch {
    return NextResponse.json(
      { error: "Erro ao buscar cliente" },
      { status: 500 }
    );
  }
}
