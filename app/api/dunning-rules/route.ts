import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export async function GET() {
  const { tenantId, error } = await requireTenant();
  if (error) return error;

  const rules = await prisma.dunningRule.findMany({
    where: { franqueadoraId: tenantId! },
    include: {
      steps: {
        orderBy: [{ trigger: "asc" }, { offsetDays: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rules);
}
