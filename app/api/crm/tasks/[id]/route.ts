import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/crm/tasks/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const task = await prisma.collectionTask.findFirst({
      where: {
        id: params.id,
        customer: { franqueadoraId: tenantId! },
      },
      include: {
        customer: { select: { name: true } },
        assignedTo: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar tarefa" }, { status: 500 });
  }
}

// PATCH /api/crm/tasks/[id] — Atualizar tarefa
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    // Verify task belongs to tenant
    const existing = await prisma.collectionTask.findFirst({
      where: {
        id: params.id,
        customer: { franqueadoraId: tenantId! },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === "CONCLUIDA") {
        data.completedAt = new Date();
      }
    }
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId || null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    const task = await prisma.collectionTask.update({
      where: { id: params.id },
      data,
      include: {
        customer: { select: { name: true } },
        assignedTo: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });
    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar tarefa" }, { status: 500 });
  }
}

// DELETE /api/crm/tasks/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const existing = await prisma.collectionTask.findFirst({
      where: {
        id: params.id,
        customer: { franqueadoraId: tenantId! },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
    }

    await prisma.collectionTask.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao remover tarefa" }, { status: 500 });
  }
}
