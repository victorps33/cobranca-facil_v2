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

    await prisma.conversation.update({
      where: { id: params.id },
      data: {
        status: "RESOLVIDA",
        resolvedAt: new Date(),
        assignedToId: session!.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Agent Escalation Resolve] Error:", err);
    return NextResponse.json(
      { error: "Falha ao resolver escalação" },
      { status: 500 }
    );
  }
}
