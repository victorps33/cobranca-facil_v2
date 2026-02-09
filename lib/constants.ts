// ---------------------------------------------------------------------------
// Constantes compartilhadas
// ---------------------------------------------------------------------------

export const FRANQUEADORA = {
  nome: "Menlo Franchising",
  razaoSocial: "Menlo Franchising Ltda",
  cnpj: "26.054.117/0001-41",
  inscricaoMunicipal: "1.234.567-8",
  endereco: "Av. Paulista, 1000, 10º andar — Bela Vista, São Paulo/SP — CEP 01310-100",
};

export function fmt(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}
