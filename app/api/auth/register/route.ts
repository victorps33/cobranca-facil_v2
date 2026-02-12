import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createDefaultDunningRule } from "@/lib/default-dunning-rule";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, empresaNome } = body;

    // Validações
    if (!name || !email || !password || !empresaNome) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter no mínimo 6 caracteres." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "E-mail inválido." },
        { status: 400 }
      );
    }

    // Verificar email único
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este e-mail já está cadastrado." },
        { status: 409 }
      );
    }

    // Criar Franqueadora + User em transação
    const hashedPassword = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      const franqueadora = await tx.franqueadora.create({
        data: {
          nome: empresaNome,
          razaoSocial: empresaNome,
          email: email.toLowerCase(),
        },
      });

      await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          role: "ADMINISTRADOR",
          franqueadoraId: franqueadora.id,
        },
      });

      await createDefaultDunningRule(tx, franqueadora.id);
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error in register:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
