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

  try {
    const body = await req.json();

    if (!body.name || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: "Campos obrigatórios: name, startDate, endDate" },
        { status: 400 }
      );
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Datas inválidas. Use formato YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const stepsData = Array.isArray(body.steps) && body.steps.length > 0
      ? body.steps.map((s: { trigger: string; offsetDays: number; channel: string; template: string }) => ({
          trigger: s.trigger || "AFTER_DUE",
          offsetDays: s.offsetDays || 0,
          channel: s.channel || "EMAIL",
          template: s.template || "",
        }))
      : undefined;

    const campaign = await prisma.negotiationCampaign.create({
      data: {
        name: body.name,
        description: body.description || null,
        startDate,
        endDate,
        maxCashDiscount: body.maxCashDiscount ?? 0.10,
        maxInstallments: body.maxInstallments ?? 6,
        monthlyInterestRate: body.monthlyInterestRate ?? 0.02,
        minInstallmentCents: body.minInstallmentCents ?? 5000,
        targetFilters: body.targetFilters || null,
        franqueadoraId: tenantIds[0],
        ...(stepsData && { steps: { create: stepsData } }),
      },
      include: { steps: true },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error("Error creating campaign:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar campanha" },
      { status: 500 }
    );
  }
}
