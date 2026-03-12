import { inngest } from "../client";
import { getERPAdapter, getERPConfig } from "@/lib/integrations/erp-factory";

export const erpPushSync = inngest.createFunction(
  {
    id: "erp-push-sync",
    retries: 3,
    concurrency: [
      {
        key: "event.data.chargeId ?? event.data.customerId",
        limit: 1,
      },
    ],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      const customerId =
        data.customerId ||
        (data.chargeId
          ? (await p.charge.findUnique({ where: { id: data.chargeId }, select: { customerId: true } }))?.customerId
          : null);
      if (systemUser && customerId) {
        await p.collectionTask.create({
          data: {
            title: `[FALHA ERP] Push sync falhou: ${event.data.event.name}`,
            description: `Erro: ${error.message}`,
            priority: "ALTA",
            status: "PENDENTE",
            customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  [
    { event: "charge/created" },
    { event: "charge/updated" },
    { event: "customer/created" },
    { event: "customer/updated" },
  ],
  async ({ event, step }) => {
    const { franqueadoraId } = event.data;

    // Step 1: Check if franqueadora has ERP configured
    const config = await step.run("check-erp-config", async () => {
      try {
        const cfg = await getERPConfig(franqueadoraId);
        return { hasERP: cfg.provider !== "NONE", provider: cfg.provider };
      } catch {
        return { hasERP: false, provider: "NONE" };
      }
    });

    if (!config.hasERP) {
      return { skipped: true, reason: "No ERP configured" };
    }

    const { prisma } = await import("@/lib/prisma");

    // Step 2: Push the entity to ERP
    if (event.name === "customer/created" || event.name === "customer/updated") {
      return await step.run("push-customer", async () => {
        const customer = await prisma.customer.findUnique({
          where: { id: event.data.customerId },
        });
        if (!customer) return { skipped: true, reason: "Customer not found" };

        // Skip if already synced recently (avoid loops)
        if (customer.erpLastSyncAt) {
          const timeSinceSync = Date.now() - customer.erpLastSyncAt.getTime();
          if (timeSinceSync < 60_000) {
            return { skipped: true, reason: "Recently synced" };
          }
        }

        // Skip if customer already has an erpCustomerId (came from ERP)
        if (customer.erpCustomerId && event.name === "customer/created") {
          return { skipped: true, reason: "Already linked to ERP" };
        }

        const adapter = await getERPAdapter(franqueadoraId);

        if (customer.erpCustomerId) {
          // Update existing customer in ERP
          await adapter.updateCustomer(customer.erpCustomerId, {
            name: customer.name,
            doc: customer.doc,
            email: customer.email,
            phone: customer.phone,
            razaoSocial: customer.razaoSocial || undefined,
          });
        } else {
          // Create new customer in ERP
          const erpCustomer = await adapter.createCustomer({
            name: customer.name,
            doc: customer.doc,
            email: customer.email,
            phone: customer.phone,
            razaoSocial: customer.razaoSocial || undefined,
            cidade: customer.cidade || undefined,
            estado: customer.estado || undefined,
          });

          // Link back
          await prisma.customer.update({
            where: { id: customer.id },
            data: {
              erpProvider: adapter.provider,
              erpCustomerId: erpCustomer.erpId,
              erpLastSyncAt: new Date(),
            },
          });
        }

        return { pushed: true, entity: "customer", id: customer.id };
      });
    }

    if (event.name === "charge/created" || event.name === "charge/updated") {
      const chargeId = (event.data as { chargeId?: string }).chargeId;
      if (!chargeId) return { skipped: true, reason: "No chargeId" };

      return await step.run("push-charge", async () => {
        const charge = await prisma.charge.findUnique({
          where: { id: chargeId },
          include: { customer: true },
        });
        if (!charge) return { skipped: true, reason: "Charge not found" };

        // Skip if already synced recently (avoid loops)
        if (charge.erpLastSyncAt) {
          const timeSinceSync = Date.now() - charge.erpLastSyncAt.getTime();
          if (timeSinceSync < 60_000) {
            return { skipped: true, reason: "Recently synced" };
          }
        }

        // Skip if charge already has an erpChargeId (came from ERP)
        if (charge.erpChargeId && event.name === "charge/created") {
          return { skipped: true, reason: "Already linked to ERP" };
        }

        const adapter = await getERPAdapter(franqueadoraId);

        if (charge.erpChargeId) {
          // Update status in ERP
          await adapter.updateChargeStatus(charge.erpChargeId, charge.status);
        } else {
          // Need customer's erpCustomerId to create charge in ERP
          if (!charge.customer.erpCustomerId) {
            return { skipped: true, reason: "Customer not linked to ERP" };
          }

          const erpCharge = await adapter.createCharge({
            customerErpId: charge.customer.erpCustomerId,
            description: charge.description,
            amountCents: charge.amountCents,
            dueDate: charge.dueDate,
            formaPagamento: charge.formaPagamento || undefined,
          });

          // Link back
          await prisma.charge.update({
            where: { id: charge.id },
            data: {
              erpProvider: adapter.provider,
              erpChargeId: erpCharge.erpId,
              erpLastSyncAt: new Date(),
            },
          });
        }

        return { pushed: true, entity: "charge", id: chargeId };
      });
    }

    return { skipped: true, reason: "Unhandled event" };
  }
);
