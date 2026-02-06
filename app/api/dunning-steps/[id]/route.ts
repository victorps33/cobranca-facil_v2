import { NextRequest, NextResponse } from "next/server";

// GET /api/dunning-steps/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const step = await prisma.dunningStep.findUnique({
      where: { id: params.id },
      include: { rule: true },
    });
    await prisma.$disconnect();
    if (!step) return NextResponse.json({ error: "Step não encontrado" }, { status: 404 });
    return NextResponse.json(step);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar step" }, { status: 500 });
  }
}

// PATCH /api/dunning-steps/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const step = await prisma.dunningStep.update({
      where: { id: params.id },
      data: body,
    });
    await prisma.$disconnect();
    return NextResponse.json(step);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar step" }, { status: 500 });
  }
}

// DELETE /api/dunning-steps/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.dunningStep.delete({ where: { id: params.id } });
    await prisma.$disconnect();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir step" }, { status: 500 });
  }
}
