import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// POST /api/simulate — Avançar N dias na simulação
export async function POST(req: NextRequest) {
  const { error } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const body = await req.json();
    const days = body.days || 7;

    // Busca estado atual
    const appState = await prisma.appState.findFirst({ where: { id: 1 } });
    const currentDate = appState?.simulatedNow || new Date();
    const newDate = new Date(currentDate.getTime() + days * 24 * 60 * 60 * 1000);

    // Atualiza ou cria estado
    await prisma.appState.upsert({
      where: { id: 1 },
      update: { simulatedNow: newDate },
      create: { id: 1, simulatedNow: newDate },
    });

    return NextResponse.json({
      success: true,
      previousDate: currentDate.toISOString(),
      newDate: newDate.toISOString(),
      daysAdvanced: days,
    });
  } catch {
    return NextResponse.json({ error: "Falha na simulação" }, { status: 500 });
  }
}
