import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";
import { inngest } from "@/inngest";

// POST /api/charges/[id]/invoice
// Request invoice (NF) emission via ERP
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const charge = await prisma.charge.findFirst({
      where: { id: params.id, customer: { franqueadoraId: tenantId! } },
      include: { customer: true },
    });

    if (!charge) {
      return NextResponse.json(
        { error: "Cobrança não encontrada" },
        { status: 404 }
      );
    }

    if (charge.invoiceStatus === "EMITIDA") {
      return NextResponse.json(
        { error: "Nota fiscal já emitida", invoiceNumber: charge.invoiceNumber },
        { status: 409 }
      );
    }

    if (charge.invoiceStatus === "PENDENTE") {
      return NextResponse.json(
        { error: "Emissão de nota fiscal já em andamento" },
        { status: 409 }
      );
    }

    // Update status to PENDENTE immediately
    await prisma.charge.update({
      where: { id: charge.id },
      data: { invoiceStatus: "PENDENTE" },
    });

    // Emit event for async processing
    try {
      await inngest.send({
        name: "charge/invoice-requested",
        data: {
          chargeId: charge.id,
          franqueadoraId: tenantId!,
          customerId: charge.customerId,
        },
      });
    } catch (inngestErr) {
      console.error("[inngest] Failed to emit charge/invoice-requested:", inngestErr);
      // Revert status
      await prisma.charge.update({
        where: { id: charge.id },
        data: { invoiceStatus: null },
      });
      return NextResponse.json(
        { error: "Falha ao iniciar emissão de NF" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Emissão de NF solicitada",
      chargeId: charge.id,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao solicitar emissão de NF" },
      { status: 500 }
    );
  }
}
