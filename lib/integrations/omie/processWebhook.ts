import { prisma } from "@/lib/prisma";
import { parse, isValid } from "date-fns";
import { mapOmieStatus } from "./statusMapper";
import { fetchOmieBoleto, fetchOmieCliente, fetchOmieTitulo } from "./client";
import type { OmieWebhookPayload } from "./types";

// ---------------------------------------------------------------------------
// Process incoming Omie webhook events
// ---------------------------------------------------------------------------

function parseOmieDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const parsed = parse(dateStr, "dd/MM/yyyy", new Date());
  return isValid(parsed) ? parsed : null;
}

/**
 * Find or create a customer from Omie data.
 * Looks up by omieCodigoCliente first, then by doc within tenant.
 * If not found, fetches from Omie API and creates locally.
 */
async function findOrCreateCustomer(
  omieCodigoCliente: number,
  franqueadoraId: string
): Promise<string> {
  const omieCode = BigInt(omieCodigoCliente);

  // Try to find existing by omieCodigoCliente
  let customer = await prisma.customer.findUnique({
    where: { omieCodigoCliente: omieCode },
  });
  if (customer) return customer.id;

  // Fetch full client data from Omie API
  console.log("[Omie Webhook] Customer not found locally, fetching from Omie:", omieCodigoCliente);
  const cli = await fetchOmieCliente(omieCodigoCliente);

  const doc = (cli.cnpj_cpf || "").replace(/\D/g, "");
  const name = cli.nome_fantasia || cli.razao_social || "Sem nome";

  // Try to find by doc within tenant
  if (doc) {
    customer = await prisma.customer.findFirst({
      where: { doc, franqueadoraId },
    });
    if (customer) {
      // Link existing customer to Omie
      await prisma.customer.update({
        where: { id: customer.id },
        data: { omieCodigoCliente: omieCode, omieLastSyncAt: new Date() },
      });
      return customer.id;
    }
  }

  // Create new customer
  const created = await prisma.customer.create({
    data: {
      name,
      doc,
      email: cli.email || "",
      phone: cli.telefone1_numero || "",
      razaoSocial: cli.razao_social || null,
      cidade: cli.cidade || null,
      estado: cli.estado || null,
      omieCodigoCliente: omieCode,
      omieCodigoIntegracao: cli.codigo_cliente_integracao || null,
      omieLastSyncAt: new Date(),
      franqueadoraId,
    },
  });

  console.log("[Omie Webhook] Created customer", created.id, name);
  return created.id;
}

/**
 * Sync boleto for a charge from Omie.
 */
async function syncBoleto(chargeId: string, codigoLancamento: number): Promise<void> {
  try {
    const boleto = await fetchOmieBoleto(codigoLancamento);
    if (boleto.cCodStatus === "0" && boleto.cLinkBoleto) {
      const barcodeValue = (boleto.cCodBarras || "").replace(/[.\s]/g, "");
      await prisma.boleto.upsert({
        where: { chargeId },
        create: {
          chargeId,
          publicUrl: boleto.cLinkBoleto,
          linhaDigitavel: boleto.cCodBarras || "",
          barcodeValue,
        },
        update: {
          publicUrl: boleto.cLinkBoleto,
          linhaDigitavel: boleto.cCodBarras || "",
          barcodeValue,
        },
      });
      console.log("[Omie Webhook] Boleto synced for charge", chargeId);
    }
  } catch (boletoErr) {
    console.warn(
      "[Omie Webhook] Boleto fetch skipped for charge",
      chargeId,
      boletoErr instanceof Error ? boletoErr.message : ""
    );
  }
}

export async function processOmieWebhook(
  payload: OmieWebhookPayload
): Promise<{ processed: boolean; detail: string }> {
  const { topic, event } = payload;

  const topicLower = topic.toLowerCase();
  console.log("[Omie Webhook] Received topic:", topic);

  const franqueadoraId = process.env.OMIE_FRANQUEADORA_ID;

  // --- Contas a Receber events ---
  if (topicLower.startsWith("financas.contareceber.")) {
    const codigoLancamento = event.codigo_lancamento_omie as number | undefined;
    if (!codigoLancamento) {
      return { processed: false, detail: "Missing codigo_lancamento_omie" };
    }

    const charge = await prisma.charge.findUnique({
      where: { omieCodigoTitulo: BigInt(codigoLancamento) },
    });

    if (charge) {
      // --- UPDATE existing charge ---
      const statusTitulo = event.status_titulo as string | undefined;
      const valorPagamento = event.valor_pagamento as number | undefined;

      const updateData: Record<string, unknown> = {
        omieLastSyncAt: new Date(),
      };

      if (statusTitulo) {
        updateData.status = mapOmieStatus(statusTitulo);
        updateData.omieStatusRaw = statusTitulo;
      }

      if (valorPagamento !== undefined) {
        updateData.amountPaidCents = Math.round(valorPagamento * 100);
      }

      if (statusTitulo && mapOmieStatus(statusTitulo) === "PAID" && !charge.paidAt) {
        updateData.paidAt = new Date();
      }

      await prisma.charge.update({
        where: { id: charge.id },
        data: updateData,
      });

      await syncBoleto(charge.id, codigoLancamento);

      console.log("[Omie Webhook] Updated charge", charge.id, "topic:", topic);
      return { processed: true, detail: `Updated charge ${charge.id}` };
    }

    // --- CREATE new charge ---
    if (!franqueadoraId) {
      return { processed: false, detail: "OMIE_FRANQUEADORA_ID not configured" };
    }

    console.log("[Omie Webhook] Charge not found, fetching from Omie:", codigoLancamento);

    let titulo;
    try {
      titulo = await fetchOmieTitulo(codigoLancamento);
    } catch (err) {
      return {
        processed: false,
        detail: `Failed to fetch titulo ${codigoLancamento} from Omie: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Find or create customer
    let customerId: string;
    try {
      customerId = await findOrCreateCustomer(titulo.codigo_cliente_fornecedor, franqueadoraId);
    } catch (err) {
      return {
        processed: false,
        detail: `Failed to find/create customer for titulo ${codigoLancamento}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const status = mapOmieStatus(titulo.status_titulo || "");
    const amountCents = Math.round((titulo.valor_documento || 0) * 100);
    const amountPaidCents = Math.round((titulo.valor_pagamento || 0) * 100);
    const dueDate = parseOmieDate(titulo.data_vencimento);
    const paidAt = parseOmieDate(titulo.data_pagamento);

    const newCharge = await prisma.charge.create({
      data: {
        customerId,
        description: titulo.numero_documento || `Omie #${codigoLancamento}`,
        amountCents,
        amountPaidCents,
        dueDate: dueDate || new Date(),
        status,
        paidAt: status === "PAID" ? (paidAt || new Date()) : null,
        omieCodigoTitulo: BigInt(codigoLancamento),
        omieCodigoIntegracao: titulo.codigo_lancamento_integracao || null,
        omieStatusRaw: titulo.status_titulo || null,
        omieLastSyncAt: new Date(),
      },
    });

    await syncBoleto(newCharge.id, codigoLancamento);

    console.log("[Omie Webhook] Created charge", newCharge.id, "for titulo", codigoLancamento);
    return { processed: true, detail: `Created charge ${newCharge.id}` };
  }

  // --- Clientes events ---
  if (topicLower.startsWith("geral.clientes.") || topicLower.startsWith("clientefornecedor.")) {
    const codigoCliente = event.codigo_cliente_omie as number | undefined;
    if (!codigoCliente) {
      return { processed: false, detail: "Missing codigo_cliente_omie" };
    }

    if (!franqueadoraId) {
      return { processed: false, detail: "OMIE_FRANQUEADORA_ID not configured" };
    }

    const customer = await prisma.customer.findUnique({
      where: { omieCodigoCliente: BigInt(codigoCliente) },
    });

    if (customer) {
      // --- UPDATE existing customer ---
      const updateData: Record<string, unknown> = {
        omieLastSyncAt: new Date(),
      };

      if (event.razao_social) updateData.razaoSocial = event.razao_social as string;
      if (event.nome_fantasia) updateData.name = event.nome_fantasia as string;
      if (event.email) updateData.email = event.email as string;
      if (event.telefone1_numero) updateData.phone = event.telefone1_numero as string;
      if (event.cidade) updateData.cidade = event.cidade as string;
      if (event.estado) updateData.estado = event.estado as string;

      await prisma.customer.update({
        where: { id: customer.id },
        data: updateData,
      });

      console.log("[Omie Webhook] Updated customer", customer.id, "topic:", topic);
      return { processed: true, detail: `Updated customer ${customer.id}` };
    }

    // --- CREATE new customer ---
    try {
      await findOrCreateCustomer(codigoCliente, franqueadoraId);
      return { processed: true, detail: `Created customer for omie code ${codigoCliente}` };
    } catch (err) {
      return {
        processed: false,
        detail: `Failed to create customer ${codigoCliente}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { processed: false, detail: `Unhandled topic: ${topic}` };
}
