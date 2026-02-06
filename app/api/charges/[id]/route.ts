import { NextRequest, NextResponse } from "next/server";

// GET /api/charges/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const charge = await prisma.charge.findUnique({
      where: { id: params.id },
      include: { customer: true, boleto: true, notificationLogs: true },
    });
    await prisma.$disconnect();
    if (!charge) return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
    return NextResponse.json(charge);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar cobrança" }, { status: 500 });
  }
}

// PATCH /api/charges/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const charge = await prisma.charge.update({
      where: { id: params.id },
      data: body,
      include: { customer: true },
    });
    await prisma.$disconnect();
    return NextResponse.json(charge);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar cobrança" }, { status: 500 });
  }
}

// DELETE /api/charges/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.charge.delete({ where: { id: params.id } });
    await prisma.$disconnect();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir cobrança" }, { status: 500 });
  }
}
