import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

// GET /api/users — Lista de users do tenant (para dropdowns)
export async function GET() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  try {
    const users = await prisma.user.findMany({
      where: { franqueadoraId: tenantId! },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
