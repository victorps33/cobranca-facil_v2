import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup, requireRole } from "@/lib/auth-helpers";
import { createHash } from "crypto";

export async function POST(request: Request) {
  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const body = await request.json();
    const { charges, franqueadoraId } = body;

    if (!charges || !Array.isArray(charges) || charges.length === 0) {
      return NextResponse.json({ error: "Nenhuma cobrança para importar." }, { status: 400 });
    }

    if (!franqueadoraId) {
      return NextResponse.json({ error: "franqueadoraId obrigatório." }, { status: 400 });
    }

    const { error } = await requireTenantOrGroup(franqueadoraId);
    if (error) return error;

    const created = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const charge of charges) {
        if (!charge.customerId || !charge.amountCents || !charge.dueDate) continue;

        const customer = await tx.customer.findFirst({
          where: { id: charge.customerId, franqueadoraId },
        });
        if (!customer) continue;

        const newCharge = await tx.charge.create({
          data: {
            customerId: charge.customerId,
            description: charge.description || "Cobrança importada",
            amountCents: Math.round(Number(charge.amountCents)),
            dueDate: new Date(charge.dueDate),
            status: charge.status || "PENDING",
            paidAt: charge.paidAt ? new Date(charge.paidAt) : null,
            categoria: charge.categoria || null,
            competencia: charge.competencia || null,
          },
        });

        const hash = createHash("sha256").update(newCharge.id).digest("hex");
        await tx.boleto.create({
          data: {
            chargeId: newCharge.id,
            linhaDigitavel: `23793.${hash.slice(0, 5)} ${hash.slice(5, 10)}.${hash.slice(10, 15)} ${hash.slice(15, 20)}.${hash.slice(20, 25)} ${hash.slice(25, 26)} ${hash.slice(26, 40)}`,
            barcodeValue: hash.slice(0, 44),
            publicUrl: `https://menlocobranca.vercel.app/boleto/${newCharge.id}`,
          },
        });

        results.push(newCharge);
      }

      return results;
    });

    return NextResponse.json({
      imported: created.length,
      total: charges.length,
    });
  } catch (error) {
    console.error("Error confirming charges import:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
