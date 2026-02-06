import { NextRequest, NextResponse } from "next/server";

// POST /api/charges/[id]/generate-boleto — Gerar boleto simulado
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const charge = await prisma.charge.findUnique({
      where: { id: params.id },
      include: { boleto: true },
    });

    if (!charge) {
      await prisma.$disconnect();
      return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
    }

    if (charge.boleto) {
      await prisma.$disconnect();
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

    await prisma.$disconnect();
    return NextResponse.json(boleto, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Falha ao gerar boleto" }, { status: 500 });
  }
}
