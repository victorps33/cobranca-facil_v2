import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error, tenantId, session } = await requireTenant();
  if (error) return error;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    await prisma.conversationRead.upsert({
      where: {
        conversationId_userId: {
          conversationId: params.id,
          userId: session!.user.id,
        },
      },
      update: { lastReadAt: new Date() },
      create: {
        conversationId: params.id,
        userId: session!.user.id,
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Inbox] Mark read error:", err);
    return NextResponse.json(
      { error: "Falha ao marcar como lida" },
      { status: 500 }
    );
  }
}
