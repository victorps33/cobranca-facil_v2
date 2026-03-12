import { prisma } from "@/lib/prisma";
import type { ERPConfig } from "@prisma/client";
import type { ERPAdapter } from "./types";
import { ContaAzulAdapter } from "./conta-azul/adapter";
import { OmieAdapter } from "./omie/adapter";

// ---------------------------------------------------------------------------
// ERP Factory — returns the correct adapter for a franqueadora
// ---------------------------------------------------------------------------

export async function getERPAdapter(
  franqueadoraId: string
): Promise<ERPAdapter> {
  const config = await getERPConfig(franqueadoraId);

  switch (config.provider) {
    case "CONTA_AZUL":
      return new ContaAzulAdapter(config);
    case "OMIE":
      return new OmieAdapter(config);
    case "NONE":
      throw new Error(
        `[ERP Factory] Franqueadora ${franqueadoraId} has no ERP configured`
      );
    default:
      throw new Error(
        `[ERP Factory] Unknown ERP provider: ${config.provider}`
      );
  }
}

export async function getERPConfig(
  franqueadoraId: string
): Promise<ERPConfig> {
  const config = await prisma.eRPConfig.findUnique({
    where: { franqueadoraId },
  });

  if (!config) {
    throw new Error(
      `[ERP Factory] No ERPConfig found for franqueadora ${franqueadoraId}`
    );
  }

  return config;
}

/**
 * Get all franqueadoras with sync enabled and a configured ERP provider.
 */
export async function getSyncableFranqueadoras(): Promise<ERPConfig[]> {
  return prisma.eRPConfig.findMany({
    where: {
      syncEnabled: true,
      provider: { not: "NONE" },
    },
  });
}
