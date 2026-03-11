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
      return processOmieWebhook(payload as OmieWebhookPayload);
    });

    // Step 2: Emit downstream events based on topic
    if (topic.startsWith("financas.contareceber")) {
      if (result.chargeId) {
        const eventName = result.status === "PAID" ? "charge/paid" : "charge/created";
        await step.sendEvent("emit-charge-event", {
          name: eventName as "charge/paid" | "charge/created",
          data: {
            chargeId: result.chargeId,
            customerId: result.customerId || "",
            ...(eventName === "charge/paid"
              ? { amountPaidCents: result.amountPaidCents || 0 }
              : { amountCents: result.amountCents || 0, dueDate: result.dueDate || "" }),
            franqueadoraId,
          },
        });
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
