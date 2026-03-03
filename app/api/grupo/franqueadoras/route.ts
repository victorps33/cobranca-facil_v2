import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const grupoId = session!.user.grupoFranqueadoraId;
  if (!grupoId) {
    return NextResponse.json({ franqueadoras: [] });
  }

  const grupo = await prisma.grupoFranqueadora.findUnique({
    where: { id: grupoId },
    include: {
      franqueadoras: {
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      },
    },
  });

  return NextResponse.json({
    franqueadoras: grupo?.franqueadoras ?? [],
  });
}
