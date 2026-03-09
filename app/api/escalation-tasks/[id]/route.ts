import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireTenantOrGroup, getAuthSession } from "@/lib/auth-helpers";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const { tenantIds, error } = await requireTenantOrGroup();
  if (error) return error;

  const session = await getAuthSession();
  const body = await req.json();

  const task = await prisma.escalationTask.findUnique({
    where: { id: params.id },
    include: { charge: { include: { customer: true } } },
  });

  if (!task || !tenantIds.includes(task.charge.customer.franqueadoraId || "")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.status === "COMPLETED") {
    data.status = "COMPLETED";
    data.resolvedAt = new Date();
    data.resolvedBy = session?.user?.id || null;
  } else if (body.status === "CANCELLED") {
    data.status = "CANCELLED";
    data.resolvedAt = new Date();
    data.resolvedBy = session?.user?.id || null;
  } else if (body.status === "IN_PROGRESS") {
    data.status = "IN_PROGRESS";
  }

  const updated = await prisma.escalationTask.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(updated);
}
