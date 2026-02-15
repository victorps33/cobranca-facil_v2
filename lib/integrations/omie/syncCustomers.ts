import { prisma } from "@/lib/prisma";
import { omieRequestAllPages } from "./client";
import type { OmieCliente, OmieSyncResult } from "./types";

// ---------------------------------------------------------------------------
// Sync customers from Omie to local DB
// ---------------------------------------------------------------------------

export async function syncOmieCustomers(
  franqueadoraId: string
): Promise<OmieSyncResult> {
  const result: OmieSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  console.log("[Omie Sync Customers] Starting sync for tenant", franqueadoraId);

  const clientes = await omieRequestAllPages<OmieCliente>(
    "/geral/clientes/",
    "ListarClientes",
    "clientes_cadastro",
    { clientesFiltro: { inativo: "N" } }
  );

  console.log(`[Omie Sync Customers] Fetched ${clientes.length} active clients`);

  for (const cli of clientes) {
    try {
      const omieCode = BigInt(cli.codigo_cliente_omie);
      const doc = (cli.cnpj_cpf || "").replace(/\D/g, "");
      const name = cli.nome_fantasia || cli.razao_social || "";
      const email = cli.email || "";
      const phone = cli.telefone1_numero || "";

      if (!doc && !name) {
        result.skipped++;
        continue;
      }

      // Try to find existing by omieCodigoCliente first, then by doc within tenant
      let existing = await prisma.customer.findUnique({
        where: { omieCodigoCliente: omieCode },
      });

      if (!existing && doc) {
        existing = await prisma.customer.findFirst({
          where: { doc, franqueadoraId },
        });
      }

      const data = {
        name: name || existing?.name || "Sem nome",
        doc: doc || existing?.doc || "",
        email: email || existing?.email || "",
        phone: phone || existing?.phone || "",
        razaoSocial: cli.razao_social || existing?.razaoSocial || null,
        cidade: cli.cidade || existing?.cidade || null,
        estado: cli.estado || existing?.estado || null,
        omieCodigoCliente: omieCode,
        omieCodigoIntegracao: cli.codigo_cliente_integracao || null,
        omieLastSyncAt: new Date(),
      };

      if (existing) {
        await prisma.customer.update({
          where: { id: existing.id },
          data,
        });
        result.updated++;
      } else {
        await prisma.customer.create({
          data: {
            ...data,
            franqueadoraId,
          },
        });
        result.created++;
      }
    } catch (err) {
      result.errors++;
      const msg = `Customer ${cli.codigo_cliente_omie}: ${err instanceof Error ? err.message : String(err)}`;
      result.errorDetails.push(msg);
      console.error("[Omie Sync Customers]", msg);
    }
  }

  console.log(
    `[Omie Sync Customers] Done: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`
  );
  return result;
}
