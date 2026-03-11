import { inngest } from "../client";
import { processOmieWebhook } from "@/lib/integrations/omie/processWebhook";
import type { OmieWebhookPayload } from "@/lib/integrations/omie/types";

export const omieSync = inngest.createFunction(
  {
    id: "omie-sync-saga",
    retries: 5,
  },
  { event: "integration/omie-webhook-received" },
  async ({ event, step }) => {
    const { topic, payload, franqueadoraId } = event.data;

    // Step 1: Process the webhook (reuse existing logic)
    const result = await step.run("process-webhook", async () => {
      return processOmieWebhook(payload as unknown as OmieWebhookPayload);
    });

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
