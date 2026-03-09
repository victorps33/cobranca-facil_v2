import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";

export async function GET() {
  const { tenantIds, error } = await requireTenantOrGroup();
  if (error) return error;

  const scores = await prisma.franchiseeRiskScore.findMany({
    where: {
      customer: { franqueadoraId: { in: tenantIds } },
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { calculatedAt: "desc" },
  });

  return NextResponse.json(scores);
}
