import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";
import { headers } from "next/headers";

export async function GET() {
  const headerList = headers();
  const requestedId = headerList.get("x-franqueadora-id") || null;
  const { tenantIds, error } = await requireTenantOrGroup(
    requestedId === "all" ? null : requestedId
  );
  if (error) return error;

  const rules = await prisma.dunningRule.findMany({
    where: { franqueadoraId: { in: tenantIds } },
    include: {
      steps: {
        orderBy: [{ trigger: "asc" }, { offsetDays: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rules);
}
