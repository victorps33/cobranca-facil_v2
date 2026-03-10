import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// POST /api/negotiation-campaigns/[id]/customers
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const campaign = await prisma.negotiationCampaign.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
    });
    if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

    const body = await req.json();
    const customerIds: string[] = body.customerIds || [];

    const created = await prisma.negotiationCampaignCustomer.createMany({
      data: customerIds.map((customerId) => ({
        campaignId: params.id,
        customerId,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ added: created.count });
  } catch {
    return NextResponse.json({ error: "Erro ao adicionar clientes à campanha" }, { status: 500 });
  }
}

// DELETE /api/negotiation-campaigns/[id]/customers
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const campaign = await prisma.negotiationCampaign.findFirst({
      where: { id: params.id, franqueadoraId: tenantId! },
    });
    if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

    const body = await req.json();
    const customerIds: string[] = body.customerIds || [];

    await prisma.negotiationCampaignCustomer.deleteMany({
      where: { campaignId: params.id, customerId: { in: customerIds } },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao remover clientes da campanha" }, { status: 500 });
  }
}
