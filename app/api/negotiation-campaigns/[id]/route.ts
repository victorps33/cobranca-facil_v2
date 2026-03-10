import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const campaign = await prisma.negotiationCampaign.findFirst({
    where: { id: params.id, franqueadoraId: tenantId! },
    include: {
      steps: { orderBy: [{ trigger: "asc" }, { offsetDays: "asc" }] },
      customers: { include: { customer: { select: { id: true, name: true } } } },
      _count: { select: { customers: true } },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;
  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const existing = await prisma.negotiationCampaign.findFirst({
    where: { id: params.id, franqueadoraId: tenantId! },
  });
  if (!existing) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.status !== undefined) data.status = body.status;
  if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
  if (body.endDate !== undefined) data.endDate = new Date(body.endDate);
  if (body.maxCashDiscount !== undefined) data.maxCashDiscount = body.maxCashDiscount;
  if (body.maxInstallments !== undefined) data.maxInstallments = body.maxInstallments;
  if (body.monthlyInterestRate !== undefined) data.monthlyInterestRate = body.monthlyInterestRate;
  if (body.minInstallmentCents !== undefined) data.minInstallmentCents = body.minInstallmentCents;
  if (body.targetFilters !== undefined) data.targetFilters = body.targetFilters;

  const campaign = await prisma.negotiationCampaign.update({
    where: { id: params.id },
    data,
    include: { steps: true, _count: { select: { customers: true } } },
  });
  return NextResponse.json(campaign);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;
  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const existing = await prisma.negotiationCampaign.findFirst({
    where: { id: params.id, franqueadoraId: tenantId! },
  });
  if (!existing) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Só é possível excluir campanhas em rascunho" }, { status: 400 });
  }

  await prisma.negotiationCampaign.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
