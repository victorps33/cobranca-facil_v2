import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

// GET /api/logs — Lista logs de notificação com filtros opcionais
export async function GET(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {
      charge: { customer: { franqueadoraId: tenantId! } },
    };
    if (channel && channel !== "all") where.channel = channel;
    if (status && status !== "all") where.status = status;

    const logs = await prisma.notificationLog.findMany({
      where,
      include: {
        charge: { include: { customer: true } },
        step: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(logs);
  } catch {
    return NextResponse.json([]);
  }
}
