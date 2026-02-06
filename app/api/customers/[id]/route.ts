import { NextRequest, NextResponse } from "next/server";

// GET /api/customers/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: { charges: { orderBy: { dueDate: "desc" } } },
    });
    await prisma.$disconnect();
    if (!customer) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar cliente" }, { status: 500 });
  }
}

// PATCH /api/customers/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: body,
    });
    await prisma.$disconnect();
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 500 });
  }
}

// DELETE /api/customers/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.customer.delete({ where: { id: params.id } });
    await prisma.$disconnect();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir cliente" }, { status: 500 });
  }
}
