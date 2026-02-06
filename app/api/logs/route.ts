import { NextRequest, NextResponse } from "next/server";

// GET /api/logs — Lista logs de notificação com filtros opcionais
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel");
    const status = searchParams.get("status");

    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const where: Record<string, unknown> = {};
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

    await prisma.$disconnect();
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json([]);
  }
}
