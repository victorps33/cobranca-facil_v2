import { inngest } from "../client";
import { processOmieWebhook } from "@/lib/integrations/omie/processWebhook";
import type { OmieWebhookPayload } from "@/lib/integrations/omie/types";

export const omieSync = inngest.createFunction(
  {
    id: "omie-sync-saga",
    retries: 5,
    concurrency: [{ key: "event.data.topic", limit: 3 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      const customer = await p.customer.findFirst({
        where: { franqueadoraId: data.franqueadoraId },
      });
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (systemUser && customer) {
        await p.collectionTask.create({
          data: {
            title: `[FALHA OMIE] Sync falhou: ${data.topic}`,
            description: `Erro: ${error.message}`,
            priority: "ALTA",
            status: "PENDENTE",
            customerId: customer.id,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  { event: "integration/omie-webhook-received" },
  async ({ event, step }) => {
    const { topic, payload, franqueadoraId } = event.data;

    // Step 1: Process the webhook (reuse existing logic)
    const result = await step.run("process-webhook", async () => {
      return processOmieWebhook(payload as unknown as OmieWebhookPayload);
    });

    // Populate generic ERP fields for traceability
    if (result.chargeId) {
      await step.run("link-erp-fields", async () => {
        const { prisma: p } = await import("@/lib/prisma");
        const charge = await p.charge.findUnique({ where: { id: result.chargeId! } });
        if (charge && !charge.erpProvider) {
          await p.charge.update({
            where: { id: result.chargeId! },
            data: {
              erpProvider: "OMIE",
              erpChargeId: charge.omieCodigoTitulo?.toString() || null,
              erpLastSyncAt: new Date(),
            },
          });
        }
        if (result.customerId) {
          const customer = await p.customer.findUnique({ where: { id: result.customerId } });
          if (customer && !customer.erpProvider) {
            await p.customer.update({
              where: { id: result.customerId },
              data: {
                erpProvider: "OMIE",
                erpCustomerId: customer.omieCodigoCliente?.toString() || null,
                erpLastSyncAt: new Date(),
              },
            });
          }
        }
      });
    }

    // Step 2: Emit downstream events based on topic
    if (topic.startsWith("financas.contareceber")) {
      if (result.chargeId) {
        if (result.status === "PAID") {
          await step.sendEvent("emit-charge-paid", {
            name: "charge/paid",
            data: {
              chargeId: result.chargeId,
              customerId: result.customerId || "",
              amountPaidCents: result.amountPaidCents || 0,
              franqueadoraId,
            },
          });
        } else {
          await step.sendEvent("emit-charge-created", {
            name: "charge/created",
            data: {
              chargeId: result.chargeId,
              customerId: result.customerId || "",
              amountCents: result.amountCents || 0,
              dueDate: result.dueDate || "",
              franqueadoraId,
            },
          });
        }
      }
    }

    if (topic.startsWith("geral.clientes") || topic.startsWith("clientefornecedor")) {
      if (result.customerId) {
        await step.sendEvent("emit-customer-event", {
          name: "customer/updated",
          data: {
            customerId: result.customerId,
            franqueadoraId,
          },
        });
      }
    }

    return { processed: true, topic, detail: result.detail };
  }
);
