import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/crm/tasks — Lista tarefas
export async function GET(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const assignedToId = searchParams.get("assignedToId");

  try {
    const tasks = await prisma.collectionTask.findMany({
      where: {
        customer: { franqueadoraId: tenantId! },
        ...(customerId && { customerId }),
        ...(status && { status: status as any }),
        ...(priority && { priority: priority as any }),
        ...(assignedToId && { assignedToId }),
      },
      include: {
        customer: { select: { name: true } },
        assignedTo: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/crm/tasks — Criar tarefa
export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await requireTenant();
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

    const task = await prisma.collectionTask.create({
      data: {
        customerId: body.customerId,
        chargeId: body.chargeId || null,
        title: body.title,
        description: body.description || null,
        status: body.status || "PENDENTE",
        priority: body.priority || "MEDIA",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        assignedToId: body.assignedToId || null,
        createdById: session!.user.id,
      },
      include: {
        customer: { select: { name: true } },
        assignedTo: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });
    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao criar tarefa" }, { status: 500 });
  }
}
