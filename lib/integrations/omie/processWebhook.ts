import { prisma } from "@/lib/prisma";
import { mapOmieStatus } from "./statusMapper";
import type { OmieWebhookPayload } from "./types";

// ---------------------------------------------------------------------------
// Process incoming Omie webhook events
// ---------------------------------------------------------------------------

export async function processOmieWebhook(
  payload: OmieWebhookPayload
): Promise<{ processed: boolean; detail: string }> {
  const { topic, event } = payload;

  console.log("[Omie Webhook] Received topic:", topic);

  // --- Contas a Receber events ---
  if (topic.startsWith("financas.contareceber.")) {
    const codigoLancamento = event.codigo_lancamento_omie as number | undefined;
    if (!codigoLancamento) {
      return { processed: false, detail: "Missing codigo_lancamento_omie" };
    }

    const charge = await prisma.charge.findUnique({
      where: { omieCodigoTitulo: BigInt(codigoLancamento) },
    });

    if (!charge) {
      return { processed: false, detail: `Charge not found for omie code ${codigoLancamento}` };
    }

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

    console.log("[Omie Webhook] Updated charge", charge.id, "topic:", topic);
    return { processed: true, detail: `Updated charge ${charge.id}` };
  }

  // --- Clientes events ---
  if (topic.startsWith("geral.clientes.")) {
    const codigoCliente = event.codigo_cliente_omie as number | undefined;
    if (!codigoCliente) {
      return { processed: false, detail: "Missing codigo_cliente_omie" };
    }

    const customer = await prisma.customer.findUnique({
      where: { omieCodigoCliente: BigInt(codigoCliente) },
    });

    if (!customer) {
      return { processed: false, detail: `Customer not found for omie code ${codigoCliente}` };
    }

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

  return { processed: false, detail: `Unhandled topic: ${topic}` };
}
