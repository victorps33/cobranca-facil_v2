import { prisma } from "@/lib/prisma";
import { parse, isValid } from "date-fns";
import { omieRequestAllPages, fetchOmieBoleto } from "./client";
import { mapOmieStatus } from "./statusMapper";
import type { OmieContaReceber, OmieSyncResult } from "./types";

// ---------------------------------------------------------------------------
// Sync contas a receber (titles) from Omie to local DB
// ---------------------------------------------------------------------------

function parseOmieDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const parsed = parse(dateStr, "dd/MM/yyyy", new Date());
  return isValid(parsed) ? parsed : null;
}

export async function syncOmieTitles(
  franqueadoraId: string
): Promise<OmieSyncResult> {
  const result: OmieSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    boletosFound: 0,
    boletosErrors: 0,
    boletosErrorDetails: [],
  };

  console.log("[Omie Sync Titles] Starting sync for tenant", franqueadoraId);

  const titulos = await omieRequestAllPages<OmieContaReceber>(
    "/financas/contareceber/",
    "ListarContasReceber",
    "conta_receber_cadastro"
  );

  console.log(`[Omie Sync Titles] Fetched ${titulos.length} titles`);

  for (const titulo of titulos) {
    try {
      const omieCode = BigInt(titulo.codigo_lancamento_omie);
      const omieClientCode = BigInt(titulo.codigo_cliente_fornecedor);

      // Find customer by omieCodigoCliente
      const customer = await prisma.customer.findUnique({
        where: { omieCodigoCliente: omieClientCode },
      });

      if (!customer) {
        result.skipped++;
        continue;
      }

      const status = mapOmieStatus(titulo.status_titulo || "");
      const amountCents = Math.round((titulo.valor_documento || 0) * 100);
      const amountPaidCents = Math.round((titulo.valor_pagamento || 0) * 100);
      const dueDate = parseOmieDate(titulo.data_vencimento);
      const paidAt = parseOmieDate(titulo.data_pagamento);

      if (!dueDate) {
        result.skipped++;
        continue;
      }

      const existing = await prisma.charge.findUnique({
        where: { omieCodigoTitulo: omieCode },
      });

      const data = {
        customerId: customer.id,
        description: titulo.numero_documento || `Omie #${titulo.codigo_lancamento_omie}`,
        amountCents,
        amountPaidCents,
        dueDate,
        status,
        paidAt: status === "PAID" ? (paidAt || existing?.paidAt || new Date()) : null,
        omieCodigoTitulo: omieCode,
        omieCodigoIntegracao: titulo.codigo_lancamento_integracao || null,
        omieStatusRaw: titulo.status_titulo || null,
        omieLastSyncAt: new Date(),
      };

      let chargeId: string;

      if (existing) {
        await prisma.charge.update({
          where: { id: existing.id },
          data,
        });
        chargeId = existing.id;
        result.updated++;
      } else {
        const created = await prisma.charge.create({ data });
        chargeId = created.id;
        result.created++;
      }

      // Fetch boleto from Omie and upsert into Boleto model
      try {
        const boleto = await fetchOmieBoleto(Number(omieCode));
        if (boleto.cCodStatus === "0" && boleto.cLinkBoleto) {
          const barcodeValue = boleto.cCodBarras.replace(/[.\s]/g, "");
          await prisma.boleto.upsert({
            where: { chargeId },
            create: {
              chargeId,
              publicUrl: boleto.cLinkBoleto,
              linhaDigitavel: boleto.cCodBarras,
              barcodeValue,
            },
            update: {
              publicUrl: boleto.cLinkBoleto,
              linhaDigitavel: boleto.cCodBarras,
              barcodeValue,
            },
          });
          result.boletosFound!++;
        } else {
          const msg = `Title ${titulo.codigo_lancamento_omie}: status=${boleto.cCodStatus} desc=${boleto.cDesStatus || "N/A"}`;
          result.boletosErrorDetails!.push(msg);
        }
      } catch (boletoErr) {
        result.boletosErrors!++;
        const msg = `Title ${titulo.codigo_lancamento_omie}: ${boletoErr instanceof Error ? boletoErr.message : String(boletoErr)}`;
        result.boletosErrorDetails!.push(msg);
        console.warn("[Omie Sync Titles] Boleto fetch failed:", msg);
      }

      // Rate limiting for boleto API calls
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      result.errors++;
      const msg = `Title ${titulo.codigo_lancamento_omie}: ${err instanceof Error ? err.message : String(err)}`;
      result.errorDetails.push(msg);
      console.error("[Omie Sync Titles]", msg);
    }
  }

  console.log(
    `[Omie Sync Titles] Done: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`
  );
  return result;
}
