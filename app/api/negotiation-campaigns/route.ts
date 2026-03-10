import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup, requireRole } from "@/lib/auth-helpers";
import { headers } from "next/headers";

export async function GET() {
  const headerList = headers();
  const requestedId = headerList.get("x-franqueadora-id") || null;
  const { tenantIds, error } = await requireTenantOrGroup(
    requestedId === "all" ? null : requestedId
  );
  if (error) return error;

  const campaigns = await prisma.negotiationCampaign.findMany({
    where: { franqueadoraId: { in: tenantIds } },
    include: {
      steps: { orderBy: [{ trigger: "asc" }, { offsetDays: "asc" }] },
      _count: { select: { customers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const headerList = headers();
  const requestedId = headerList.get("x-franqueadora-id") || null;
  const { tenantIds, error } = await requireTenantOrGroup(
    requestedId === "all" ? null : requestedId
  );
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const body = await req.json();
  const campaign = await prisma.negotiationCampaign.create({
    data: {
      name: body.name,
      description: body.description || null,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      maxCashDiscount: body.maxCashDiscount ?? 0.10,
      maxInstallments: body.maxInstallments ?? 6,
      monthlyInterestRate: body.monthlyInterestRate ?? 0.02,
      minInstallmentCents: body.minInstallmentCents ?? 5000,
      targetFilters: body.targetFilters || null,
      franqueadoraId: tenantIds[0],
    },
    include: { steps: true },
  });

  return NextResponse.json(campaign, { status: 201 });
}
