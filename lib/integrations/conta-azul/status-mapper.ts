import type { ChargeStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Maps Conta Azul receivable status to internal ChargeStatus
// ---------------------------------------------------------------------------

const CONTA_AZUL_STATUS_MAP: Record<string, ChargeStatus> = {
  PENDING: "PENDING",
  EM_ABERTO: "PENDING",
  OVERDUE: "OVERDUE",
  VENCIDO: "OVERDUE",
  ACQUITTED: "PAID",
  LIQUIDADO: "PAID",
  PARTIALLY_ACQUITTED: "PARTIAL",
  CANCELLED: "CANCELED",
  CANCELADO: "CANCELED",
};

export function mapContaAzulStatus(status: string): ChargeStatus {
  const normalized = status.toUpperCase().trim();
  return CONTA_AZUL_STATUS_MAP[normalized] ?? "PENDING";
}
