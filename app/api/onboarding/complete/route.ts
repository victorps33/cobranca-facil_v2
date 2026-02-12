import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function POST() {
  const { session, error } = await requireAuth();
  if (error) return error;

  await prisma.user.update({
    where: { id: session!.user.id },
    data: { onboardingCompletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
