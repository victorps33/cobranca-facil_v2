import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireTenant();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const stepId = searchParams.get("stepId");
  if (!stepId)
    return NextResponse.json({ error: "stepId required" }, { status: 400 });

  const variants = await prisma.stepVariant.findMany({
    where: { stepId },
    orderBy: { label: "asc" },
  });

  return NextResponse.json(variants);
}

export async function POST(req: NextRequest) {
  const { error } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const { stepId, label, template, generatedByAi } = await req.json();

  const variant = await prisma.stepVariant.create({
    data: { stepId, label, template, generatedByAi: generatedByAi || false },
  });

  return NextResponse.json(variant, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.stepVariant.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
