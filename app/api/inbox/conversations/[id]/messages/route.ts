import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { inngest } from "@/inngest";

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

    // If not internal, emit message/sent event for async dispatch
    if (!isInternal) {
      try {
        await inngest.send({
          name: "message/sent",
          data: {
            messageId: message.id,
            conversationId: conversation.id,
            chargeId: undefined,
            channel: conversation.channel,
            content: message.content,
            customerId: conversation.customerId,
            franqueadoraId: tenantId!,
          },
        });
      } catch (inngestErr) {
        console.error("[inngest] Failed to emit message/sent:", inngestErr);
      }
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
