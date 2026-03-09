import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const { tenantIds, error } = await requireTenantOrGroup();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {
    charge: {
      customer: { franqueadoraId: { in: tenantIds } },
    },
  };

  if (status) where.status = status;
  if (type) where.type = type;

  const tasks = await prisma.escalationTask.findMany({
    where,
    include: {
      charge: {
        include: {
          customer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tasks);
}
