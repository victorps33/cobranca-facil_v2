import { NextRequest, NextResponse } from "next/server";

// GET /api/dunning-rules/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const rule = await prisma.dunningRule.findUnique({
      where: { id: params.id },
      include: { steps: { orderBy: { offsetDays: "asc" } } },
    });
    await prisma.$disconnect();
    if (!rule) return NextResponse.json({ error: "Régua não encontrada" }, { status: 404 });
    return NextResponse.json(rule);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar régua" }, { status: 500 });
  }
}

// PATCH /api/dunning-rules/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const rule = await prisma.dunningRule.update({
      where: { id: params.id },
      data: body,
      include: { steps: true },
    });
    await prisma.$disconnect();
    return NextResponse.json(rule);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar régua" }, { status: 500 });
  }
}

// DELETE /api/dunning-rules/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.dunningRule.delete({ where: { id: params.id } });
    await prisma.$disconnect();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir régua" }, { status: 500 });
  }
}
