import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const action = searchParams.get("action");

  try {
    const where: Record<string, unknown> = { franqueadoraId: tenantId! };
    if (action) where.action = action;

    const [decisions, total] = await Promise.all([
      prisma.agentDecisionLog.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          conversation: { select: { id: true, channel: true } },
          charge: {
            select: { id: true, description: true, amountCents: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.agentDecisionLog.count({ where }),
    ]);

    return NextResponse.json({
      decisions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[Agent Decisions] Error:", err);
    return NextResponse.json(
      { error: "Falha ao carregar decisões" },
      { status: 500 }
    );
  }
}
