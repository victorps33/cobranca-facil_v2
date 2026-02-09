import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// POST /api/charges/[id]/generate-boleto — Gerar boleto simulado
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const charge = await prisma.charge.findFirst({
      where: { id: params.id, customer: { franqueadoraId: tenantId! } },
      include: { boleto: true },
    });

    if (!charge) {
      return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
    }

    if (charge.boleto) {
      return NextResponse.json(charge.boleto);
    }

    // Gera linha digitável determinística baseada no ID
    const hash = params.id.replace(/[^0-9]/g, "").padEnd(47, "0").slice(0, 47);
    const linhaDigitavel = `23793.${hash.slice(0, 5)} ${hash.slice(5, 15)}.${hash.slice(15, 20)} ${hash.slice(20, 30)}.${hash.slice(30, 35)} ${hash.slice(35, 36)} ${hash.slice(36, 47)}`;
    const barcodeValue = hash.slice(0, 44);

    const boleto = await prisma.boleto.create({
      data: {
        chargeId: params.id,
        linhaDigitavel,
        barcodeValue,
        publicUrl: `/boleto/${params.id}`,
      },
    });

    return NextResponse.json(boleto, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao gerar boleto" }, { status: 500 });
  }
}
