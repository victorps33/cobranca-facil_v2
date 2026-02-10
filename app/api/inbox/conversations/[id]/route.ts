import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true, doc: true },
          include: {
            charges: {
              where: { status: { in: ["PENDING", "OVERDUE"] } },
              orderBy: { dueDate: "asc" },
              take: 5,
              select: {
                id: true,
                description: true,
                amountCents: true,
                dueDate: true,
                status: true,
              },
            },
            collectionTasks: {
              where: { status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
              take: 5,
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                dueDate: true,
              },
            },
          },
        },
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            senderUser: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(conversation);
  } catch (err) {
    console.error("[Inbox] Conversation detail error:", err);
    return NextResponse.json(
      { error: "Falha ao carregar conversa" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const body = await request.json();
    const { status, assignedToId } = body;

    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === "RESOLVIDA") updateData.resolvedAt = new Date();
    }
    if (assignedToId !== undefined) {
      updateData.assignedToId = assignedToId || null;
    }

    const updated = await prisma.conversation.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[Inbox] Conversation update error:", err);
    return NextResponse.json(
      { error: "Falha ao atualizar conversa" },
      { status: 500 }
    );
  }
}
