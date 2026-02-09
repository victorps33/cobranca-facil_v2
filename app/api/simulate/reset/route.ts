import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// POST /api/simulate/reset — Resetar para data real
export async function POST() {
  const { error } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    await prisma.appState.upsert({
      where: { id: 1 },
      update: { simulatedNow: null },
      create: { id: 1, simulatedNow: null },
    });

    return NextResponse.json({
      success: true,
      date: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Falha ao resetar data" }, { status: 500 });
  }
}
