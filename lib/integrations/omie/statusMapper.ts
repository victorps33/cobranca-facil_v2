import { ChargeStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Maps Omie status_titulo strings to internal ChargeStatus enum
// ---------------------------------------------------------------------------

const OMIE_STATUS_MAP: Record<string, ChargeStatus> = {
  EMABERTO: "PENDING",
  AVENCER: "PENDING",
  VENCEHOJE: "PENDING",
  ATRASADO: "OVERDUE",
  PAGTO_PARCIAL: "PARTIAL",
  LIQUIDADO: "PAID",
  RECEBIDO: "PAID",
  CANCELADO: "CANCELED",
};

export function mapOmieStatus(omieStatus: string): ChargeStatus {
  const normalized = omieStatus.toUpperCase().trim();
  return OMIE_STATUS_MAP[normalized] ?? "PENDING";
}
