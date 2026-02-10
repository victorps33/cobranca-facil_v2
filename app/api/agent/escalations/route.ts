import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export async function GET() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const escalations = await prisma.conversation.findMany({
      where: {
        franqueadoraId: tenantId!,
        status: "PENDENTE_HUMANO",
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        agentDecisions: {
          where: { action: "ESCALATE_HUMAN" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    return NextResponse.json(escalations);
  } catch (err) {
    console.error("[Agent Escalations] Error:", err);
    return NextResponse.json(
      { error: "Falha ao carregar escalações" },
      { status: 500 }
    );
  }
}
