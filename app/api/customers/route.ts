import { NextRequest, NextResponse } from "next/server";

// GET /api/customers — Lista clientes
export async function GET() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const customers = await prisma.customer.findMany({
      include: { charges: true },
      orderBy: { createdAt: "desc" },
    });
    await prisma.$disconnect();
    return NextResponse.json(customers);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/customers — Criar cliente
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        doc: body.doc,
        email: body.email,
        phone: body.phone,
      },
    });
    await prisma.$disconnect();
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Falha ao criar cliente" }, { status: 500 });
  }
}
