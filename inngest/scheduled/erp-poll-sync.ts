import { inngest } from "../client";
import { getSyncableFranqueadoras, getERPAdapter } from "@/lib/integrations/erp-factory";
import { syncFranqueadora } from "@/lib/integrations/sync-engine";

export const erpPollSync = inngest.createFunction(
  {
    id: "erp-poll-sync",
    retries: 3,
    concurrency: [{ key: "erp-poll-sync-global", limit: 1 }],
    onFailure: async ({ error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      const customer = await p.customer.findFirst();
      if (systemUser && customer) {
        await p.collectionTask.create({
          data: {
            title: "[FALHA ERP] Poll sync falhou",
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
  { cron: "*/10 * * * *" },
  async ({ step }) => {
    // Step 1: Get all syncable franqueadoras
    const configs = await step.run("get-syncable-configs", async () => {
      const cfgs = await getSyncableFranqueadoras();
      return cfgs.map((c) => ({
        id: c.id,
        franqueadoraId: c.franqueadoraId,
        provider: c.provider,
      }));
    });

    if (configs.length === 0) {
      return { synced: 0 };
    }

    // Step 2: Sync each franqueadora in a separate step
    const results: Record<string, unknown> = {};
    for (const config of configs) {
      const syncResult = await step.run(
        `sync-${config.franqueadoraId}`,
        async () => {
          const adapter = await getERPAdapter(config.franqueadoraId);
          return syncFranqueadora(config.franqueadoraId, adapter);
        }
      );
      results[config.franqueadoraId] = syncResult;

      // Emit sync completed event
      await step.sendEvent(`emit-sync-completed-${config.franqueadoraId}`, {
        name: "integration/erp-sync-completed",
        data: {
          franqueadoraId: config.franqueadoraId,
          provider: config.provider,
          customersCreated: syncResult.customersCreated,
          customersUpdated: syncResult.customersUpdated,
          chargesCreated: syncResult.chargesCreated,
          chargesUpdated: syncResult.chargesUpdated,
          errors: syncResult.customersErrors + syncResult.chargesErrors,
        },
      });
    }

    return { synced: configs.length, results };
  }
);
