import { NextRequest, NextResponse } from "next/server";

// GET /api/charges — Lista cobranças
export async function GET() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const charges = await prisma.charge.findMany({
      include: { customer: true, boleto: true },
      orderBy: { createdAt: "desc" },
    });
    await prisma.$disconnect();
    return NextResponse.json(charges);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/charges — Criar cobrança
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const charge = await prisma.charge.create({
      data: {
        customerId: body.customerId,
        description: body.description,
        amountCents: body.amountCents,
        dueDate: new Date(body.dueDate),
        status: "PENDING",
      },
      include: { customer: true },
    });
    await prisma.$disconnect();
    return NextResponse.json(charge, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Falha ao criar cobrança" }, { status: 500 });
  }
}
