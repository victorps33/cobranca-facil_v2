import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { dispatchMessage } from "@/lib/agent/dispatch";
import { createInteractionLog } from "@/lib/inbox/sync";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const after = searchParams.get("after");

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

    const where: Record<string, unknown> = {
      conversationId: params.id,
    };

    if (after) {
      const afterMsg = await prisma.message.findUnique({
        where: { id: after },
        select: { createdAt: true },
      });
      if (afterMsg) {
        where.createdAt = { gt: afterMsg.createdAt };
      }
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        senderUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(messages);
  } catch (err) {
    console.error("[Inbox] Messages list error:", err);
    return NextResponse.json(
      { error: "Falha ao carregar mensagens" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error, tenantId, session } = await requireTenant();
  if (error) return error;

  try {
    const body = await request.json();
    const { content, isInternal } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Conteúdo é obrigatório" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
      include: { customer: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId: params.id,
        sender: "AGENT",
        senderUserId: session!.user.id,
        content,
        contentType: "text",
        channel: conversation.channel,
        isInternal: isInternal || false,
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: params.id },
      data: { lastMessageAt: new Date(), status: "ABERTA" },
    });

    // If not internal, dispatch via provider
    if (!isInternal) {
      const queueItem = await prisma.messageQueue.create({
        data: {
          customerId: conversation.customerId,
          conversationId: params.id,
          channel: conversation.channel,
          content,
          status: "PENDING",
          priority: 3, // High priority for human responses
          scheduledFor: new Date(),
          franqueadoraId: tenantId!,
        },
      });

      // Sync to InteractionLog
      await createInteractionLog({
        customerId: conversation.customerId,
        channel: conversation.channel,
        content,
        direction: "OUTBOUND",
        franqueadoraId: tenantId!,
      });
    } else {
      // Internal note — create NOTA_INTERNA in InteractionLog
      const systemUser = await prisma.user.findFirst({
        where: { id: session!.user.id },
      });
      if (systemUser) {
        await prisma.interactionLog.create({
          data: {
            customerId: conversation.customerId,
            type: "NOTA_INTERNA",
            direction: "OUTBOUND",
            content,
            createdById: session!.user.id,
          },
        });
      }
    }

    return NextResponse.json(message);
  } catch (err) {
    console.error("[Inbox] Send message error:", err);
    return NextResponse.json(
      { error: "Falha ao enviar mensagem" },
      { status: 500 }
    );
  }
}
