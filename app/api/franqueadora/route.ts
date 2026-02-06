import { NextRequest, NextResponse } from "next/server";

// GET /api/franqueadora — Retorna o cadastro da franqueadora (ou null)
export async function GET() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const franqueadora = await prisma.franqueadora.findFirst();
    await prisma.$disconnect();
    return NextResponse.json(franqueadora);
  } catch {
    return NextResponse.json(null);
  }
}

// PUT /api/franqueadora — Upsert (cria ou atualiza)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    // Validação de campos obrigatórios
    const errors: string[] = [];
    if (!body.nome?.trim()) errors.push("Nome é obrigatório");
    if (!body.razaoSocial?.trim()) errors.push("Razão Social é obrigatória");
    if (!body.email?.trim()) {
      errors.push("E-mail é obrigatório");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push("E-mail inválido");
    }

    if (body.emailSecundario?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.emailSecundario)) {
      errors.push("E-mail secundário inválido");
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const data = {
      nome: body.nome.trim(),
      razaoSocial: body.razaoSocial.trim(),
      email: body.email.trim(),
      cnpj: body.cnpj?.trim() || null,
      emailSecundario: body.emailSecundario?.trim() || null,
      endereco: body.endereco?.trim() || null,
      celular: body.celular?.trim() || null,
      celularSecundario: body.celularSecundario?.trim() || null,
      telefone: body.telefone?.trim() || null,
      telefoneSecundario: body.telefoneSecundario?.trim() || null,
      responsavel: body.responsavel?.trim() || null,
    };

    // Single-tenant: busca primeiro registro existente
    const existing = await prisma.franqueadora.findFirst();

    let franqueadora;
    if (existing) {
      franqueadora = await prisma.franqueadora.update({
        where: { id: existing.id },
        data,
      });
    } else {
      franqueadora = await prisma.franqueadora.create({ data });
    }

    await prisma.$disconnect();
    return NextResponse.json(franqueadora);
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao salvar dados da franqueadora" },
      { status: 500 }
    );
  }
}
