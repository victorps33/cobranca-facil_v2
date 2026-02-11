import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-helpers";

// GET /api/franqueadora — Retorna o cadastro da franqueadora (ou null)
export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const franqueadoraId = session!.user.franqueadoraId;
    if (!franqueadoraId) return NextResponse.json(null);

    const franqueadora = await prisma.franqueadora.findUnique({
      where: { id: franqueadoraId },
      include: { contatos: { orderBy: [{ isPrimario: "desc" }, { createdAt: "asc" }] } },
    });
    return NextResponse.json(franqueadora);
  } catch {
    return NextResponse.json(null);
  }
}

// PUT /api/franqueadora — Upsert (cria ou atualiza)
export async function PUT(req: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

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

    const franqueadoraId = session!.user.franqueadoraId;
    const userId = session!.user.id;

    // Preparar contatos (se enviados)
    const contatos: { nome: string; telefone: string; isPrimario: boolean }[] = Array.isArray(body.contatos)
      ? body.contatos
          .filter((c: { nome?: string; telefone?: string }) => c.nome?.trim() && c.telefone?.trim())
          .map((c: { nome: string; telefone: string; isPrimario?: boolean }, i: number) => ({
            nome: c.nome.trim(),
            telefone: c.telefone.trim(),
            isPrimario: i === 0 || !!c.isPrimario,
          }))
      : [];

    let franqueadora: { id: string };
    if (franqueadoraId) {
      franqueadora = await prisma.franqueadora.update({
        where: { id: franqueadoraId },
        data,
      });

      // Atualizar contatos: deletar existentes e recriar
      if (Array.isArray(body.contatos)) {
        await prisma.contatoFranqueadora.deleteMany({ where: { franqueadoraId } });
        if (contatos.length > 0) {
          await prisma.contatoFranqueadora.createMany({
            data: contatos.map((c) => ({ ...c, franqueadoraId })),
          });
        }
      }
    } else {
      franqueadora = await prisma.franqueadora.create({ data });

      // Criar contatos
      if (contatos.length > 0) {
        await prisma.contatoFranqueadora.createMany({
          data: contatos.map((c) => ({ ...c, franqueadoraId: franqueadora.id })),
        });
      }

      // Associar a franqueadora ao usuário que a criou
      await prisma.user.update({
        where: { id: userId },
        data: { franqueadoraId: franqueadora.id },
      });
    }

    // Retornar com contatos incluídos
    const result = await prisma.franqueadora.findUnique({
      where: { id: franqueadora.id },
      include: { contatos: { orderBy: [{ isPrimario: "desc" }, { createdAt: "asc" }] } },
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Falha ao salvar dados da franqueadora" },
      { status: 500 }
    );
  }
}
