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

export async function requireTenantOrGroup(requestedFranqueadoraId?: string | null) {
  const { session, error } = await requireAuth();
  if (error) return { session: null, tenantIds: [] as string[], error };

  const grupoId = session!.user.grupoFranqueadoraId;
  const singleTenantId = session!.user.franqueadoraId;

  // User belongs to a group — resolve group franqueadoras
  if (grupoId) {
    const { prisma } = await import("@/lib/prisma");
    const grupo = await prisma.grupoFranqueadora.findUnique({
      where: { id: grupoId },
      include: { franqueadoras: { select: { id: true } } },
    });

    if (!grupo) {
      return {
        session: null,
        tenantIds: [] as string[],
        error: NextResponse.json({ error: "Grupo não encontrado" }, { status: 403 }),
      };
    }

    const groupIds = grupo.franqueadoras.map((f) => f.id);

    // If a specific franqueadora was requested, validate it belongs to the group
    if (requestedFranqueadoraId && requestedFranqueadoraId !== "all") {
      if (!groupIds.includes(requestedFranqueadoraId)) {
        return {
          session: null,
          tenantIds: [] as string[],
          error: NextResponse.json({ error: "Franqueadora não pertence ao grupo" }, { status: 403 }),
        };
      }
      return { session, tenantIds: [requestedFranqueadoraId], error: null };
    }

    // Return all group franqueadoras
    return { session, tenantIds: groupIds, error: null };
  }

  // Single-tenant user — same behavior as before
  if (!singleTenantId) {
    return {
      session: null,
      tenantIds: [] as string[],
      error: NextResponse.json(
        { error: "Tenant não configurado" },
        { status: 403 }
      ),
    };
  }

  return { session, tenantIds: [singleTenantId], error: null };
}
