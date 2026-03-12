import { inngest } from "../client";
import { getERPAdapter } from "@/lib/integrations/erp-factory";

const MAX_STATUS_CHECKS = 5;

export const erpCreateInvoice = inngest.createFunction(
  {
    id: "erp-create-invoice",
    retries: 5,
    concurrency: [{ key: "event.data.chargeId", limit: 1 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (systemUser) {
        await p.collectionTask.create({
          data: {
            title: `[CRITICA] Emissão de NF falhou: cobrança ${data.chargeId}`,
            description: `Erro: ${error.message}. Franqueadora: ${data.franqueadoraId}`,
            priority: "CRITICA",
            status: "PENDENTE",
            customerId: data.customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  { event: "charge/invoice-requested" },
  async ({ event, step }) => {
    const { chargeId, franqueadoraId, customerId } = event.data;
    const { prisma } = await import("@/lib/prisma");

    // Step 1: Load charge and customer data
    const charge = await step.run("load-charge", async () => {
      const c = await prisma.charge.findUnique({
        where: { id: chargeId },
        include: { customer: true },
      });
      if (!c) throw new Error(`Charge ${chargeId} not found`);
      return {
        id: c.id,
        description: c.description,
        amountCents: c.amountCents,
        customerErpId: c.customer.erpCustomerId,
        customerId: c.customerId,
      };
    });

    if (!charge.customerErpId) {
      throw new Error(`Customer ${charge.customerId} not linked to ERP`);
    }

    // Step 2: Request invoice creation in ERP
    const invoice = await step.run("request-invoice", async () => {
      const adapter = await getERPAdapter(franqueadoraId);
      return adapter.createInvoice(chargeId, {
        customerErpId: charge.customerErpId!,
        amountCents: charge.amountCents,
        description: charge.description,
      });
    });

    // Step 3: If still PENDENTE, poll for completion (async processing)
    let finalInvoice = invoice;
    if (invoice.status === "PENDENTE" && invoice.erpId) {
      for (let attempt = 0; attempt < MAX_STATUS_CHECKS; attempt++) {
        // Wait with increasing backoff: 30s, 60s, 90s, 120s, 150s
        await step.sleep(
          `wait-invoice-status-${attempt}`,
          `${(attempt + 1) * 30}s`
        );

        const checked = await step.run(
          `check-invoice-status-${attempt}`,
          async () => {
            const adapter = await getERPAdapter(franqueadoraId);
            return adapter.getInvoice(invoice.erpId);
          }
        );

        if (checked && checked.status !== "PENDENTE") {
          finalInvoice = checked;
          break;
        }
      }
    }

    // Step 4: Update charge with invoice data
    await step.run("update-charge", async () => {
      await prisma.charge.update({
        where: { id: chargeId },
        data: {
          invoiceNumber: finalInvoice.number || null,
          invoiceStatus: finalInvoice.status,
          invoicePdfUrl: finalInvoice.pdfUrl || null,
          invoiceIssuedAt: finalInvoice.issuedAt || (finalInvoice.status === "EMITIDA" ? new Date() : null),
          nfEmitida: finalInvoice.status === "EMITIDA",
        },
      });
    });

    // Step 5: Emit invoice-issued event if successful
    if (finalInvoice.status === "EMITIDA") {
      await step.sendEvent("emit-invoice-issued", {
        name: "charge/invoice-issued",
        data: {
          chargeId,
          invoiceNumber: finalInvoice.number,
          invoicePdfUrl: finalInvoice.pdfUrl,
          franqueadoraId,
        },
      });
    }

    return {
      chargeId,
      invoiceNumber: finalInvoice.number,
      status: finalInvoice.status,
    };
  }
);
