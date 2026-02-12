// ---------------------------------------------------------------------------
// Constantes compartilhadas
// ---------------------------------------------------------------------------

export function fmt(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}
