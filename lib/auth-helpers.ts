import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getAuthSession();
  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }),
    };
  }
  return { session, error: null };
}

export async function requireRole(roles: UserRole[]) {
  const { session, error } = await requireAuth();
  if (error) return { session: null, error };

  if (!roles.includes(session!.user.role)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }),
    };
  }
  return { session, error: null };
}

export async function requireTenant() {
  const { session, error } = await requireAuth();
  if (error) return { session: null, tenantId: null, error };

  const tenantId = session!.user.franqueadoraId;
  if (!tenantId) {
    return {
      session: null,
      tenantId: null,
      error: NextResponse.json(
        { error: "Tenant não configurado" },
        { status: 403 }
      ),
    };
  }
  return { session, tenantId, error: null };
}
