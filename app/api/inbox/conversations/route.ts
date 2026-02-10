import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const channel = searchParams.get("channel");
  const assignedTo = searchParams.get("assignedTo");
  const search = searchParams.get("search");

  try {
    const where: Prisma.ConversationWhereInput = {
      franqueadoraId: tenantId!,
    };

    if (status) {
      where.status = status as Prisma.EnumConversationStatusFilter;
    }
    if (channel) {
      where.channel = channel as Prisma.EnumChannelFilter;
    }
    if (assignedTo) {
      where.assignedToId = assignedTo === "unassigned" ? null : assignedTo;
    }
    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { email: { contains: search, mode: "insensitive" } } },
        { subject: { contains: search, mode: "insensitive" } },
      ];
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        assignedTo: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, sender: true, createdAt: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    return NextResponse.json(conversations);
  } catch (err) {
    console.error("[Inbox] Conversations list error:", err);
    return NextResponse.json(
      { error: "Falha ao listar conversas" },
      { status: 500 }
    );
  }
}
