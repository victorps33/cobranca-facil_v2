import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";
import { headers } from "next/headers";

export async function GET(req: Request) {
  const headerList = headers();
  const requestedId = headerList.get("x-franqueadora-id") || null;
  const { tenantIds, error } = await requireTenantOrGroup(
    requestedId === "all" ? null : requestedId
  );
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const riskProfile = searchParams.get("riskProfile");

  const where: Record<string, unknown> = {
    franqueadoraId: { in: tenantIds },
  };

  if (riskProfile) where.riskProfile = riskProfile;

  const rules = await prisma.dunningRule.findMany({
    where,
    include: {
      steps: {
        orderBy: [{ trigger: "asc" }, { offsetDays: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rules);
}
