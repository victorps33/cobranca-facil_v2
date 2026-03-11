import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";
import { inngest } from "@/inngest";

// POST /api/dunning/run — Trigger dunning for overdue charges via events
export async function POST() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    // Find overdue and pending charges for this tenant
    const now = new Date();
    const charges = await prisma.charge.findMany({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        customer: { franqueadoraId: tenantId! },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        customerId: true,
        dueDate: true,
        status: true,
        customer: { select: { franqueadoraId: true } },
      },
    });

    if (charges.length === 0) {
      return NextResponse.json({
        success: true,
        eventsEmitted: 0,
        processedCharges: 0,
      });
    }

    // Mark PENDING charges as OVERDUE
    const pendingIds = charges.filter((c) => c.status === "PENDING").map((c) => c.id);
    if (pendingIds.length > 0) {
      await prisma.charge.updateMany({
        where: { id: { in: pendingIds }, status: "PENDING" },
        data: { status: "OVERDUE" },
      });
    }

    // Emit charge/overdue events — the dunning-saga handles the rest
    const validCharges = charges.filter((c) => c.customer.franqueadoraId != null);
    if (validCharges.length > 0) {
      try {
        await inngest.send(
          validCharges.map((charge) => ({
            name: "charge/overdue" as const,
            data: {
              chargeId: charge.id,
              customerId: charge.customerId,
              daysPastDue: Math.floor(
                (now.getTime() - new Date(charge.dueDate).getTime()) / (1000 * 60 * 60 * 24)
              ),
              franqueadoraId: charge.customer.franqueadoraId!,
            },
          }))
        );
      } catch (inngestErr) {
        console.error("[inngest] Failed to emit charge/overdue:", inngestErr);
      }
    }

    return NextResponse.json({
      success: true,
      eventsEmitted: validCharges.length,
      processedCharges: charges.length,
    });
  } catch {
    return NextResponse.json({ error: "Falha ao executar régua" }, { status: 500 });
  }
}
