export interface ApuracaoDetalhe {
  franqueado: string;
  pdv: number;         // centavos
  ifood: number;       // centavos
  rappi: number;       // centavos
  faturamento: number; // centavos
  royalties: number;   // centavos
  marketing: number;   // centavos
  totalCobrado: number; // centavos
  nfEmitida: boolean;
}

export interface ApuracaoCiclo {
  id: string;
  competencia: string;       // "Jan/2026"
  competenciaShort: string;  // "Jan/26"
  dataApuracao: string;       // ISO date de conclusão
  franqueados: number;
  faturamentoTotal: number;   // centavos
  royaltyTotal: number;
  marketingTotal: number;
  totalCobrado: number;
  nfsEmitidas: number;
  status: "concluido";
  detalhes: ApuracaoDetalhe[];
}

// ---------------------------------------------------------------------------
// Detalhes por franqueado — dados dummy com variação mensal
// ---------------------------------------------------------------------------

// Base de faturamento por loja (centavos). Cada mês aplica um multiplicador.
const lojaBase: { nome: string; pdv: number; ifood: number; rappi: number }[] = [
  { nome: "Franquia Morumbi",      pdv: 18500000, ifood: 4200000, rappi: 0 },
  { nome: "Franquia Vila Mariana",  pdv: 14200000, ifood: 3800000, rappi: 0 },
  { nome: "Franquia Santo Amaro",   pdv: 11800000, ifood: 2900000, rappi: 0 },
  { nome: "Franquia Campo Belo",    pdv: 9500000,  ifood: 2100000, rappi: 0 },
  { nome: "Franquia Itaim Bibi",    pdv: 21000000, ifood: 5500000, rappi: 0 },
  { nome: "Franquia Moema",         pdv: 7800000,  ifood: 1900000, rappi: 0 },
  { nome: "Franquia Brooklin",      pdv: 15600000, ifood: 4100000, rappi: 0 },
  { nome: "Franquia Saude",         pdv: 6200000,  ifood: 1500000, rappi: 0 },
  { nome: "Franquia Recife",        pdv: 8900000,  ifood: 2200000, rappi: 0 },
  { nome: "Franquia Fortaleza",     pdv: 7600000,  ifood: 1800000, rappi: 0 },
  { nome: "Franquia Salvador",      pdv: 6800000,  ifood: 1600000, rappi: 0 },
  { nome: "Franquia Curitiba",      pdv: 9350000,  ifood: 2400000, rappi: 0 },
];

function gerarDetalhes(
  multiplicador: number,
  qtdLojas: number,
  royaltyPct = 0.05,
  mktPct = 0.02,
): ApuracaoDetalhe[] {
  return lojaBase.slice(0, qtdLojas).map((loja) => {
    const pdv = Math.round(loja.pdv * multiplicador);
    const ifood = Math.round(loja.ifood * multiplicador);
    const rappi = Math.round(loja.rappi * multiplicador);
    const faturamento = pdv + ifood + rappi;
    const royalties = Math.round(faturamento * royaltyPct);
    const marketing = Math.round(faturamento * mktPct);
    return {
      franqueado: loja.nome,
      pdv,
      ifood,
      rappi,
      faturamento,
      royalties,
      marketing,
      totalCobrado: royalties + marketing,
      nfEmitida: true,
    };
  });
}

// Multiplicadores simulando sazonalidade
const detalhesJan26 = gerarDetalhes(0.95, 12);
const detalhesDez25 = gerarDetalhes(1.08, 12); // Dezembro forte
const detalhesNov25 = gerarDetalhes(0.93, 11);
const detalhesOut25 = gerarDetalhes(0.88, 11);
const detalhesSet25 = gerarDetalhes(0.85, 10);

export const ciclosHistorico: ApuracaoCiclo[] = [
  {
    id: "ciclo-jan26",
    competencia: "Jan/2026",
    competenciaShort: "Jan/26",
    dataApuracao: "2026-02-03",
    franqueados: 12,
    faturamentoTotal: detalhesJan26.reduce((s, d) => s + d.faturamento, 0),
    royaltyTotal: detalhesJan26.reduce((s, d) => s + d.royalties, 0),
    marketingTotal: detalhesJan26.reduce((s, d) => s + d.marketing, 0),
    totalCobrado: detalhesJan26.reduce((s, d) => s + d.totalCobrado, 0),
    nfsEmitidas: 12,
    status: "concluido",
    detalhes: detalhesJan26,
  },
  {
    id: "ciclo-dez25",
    competencia: "Dez/2025",
    competenciaShort: "Dez/25",
    dataApuracao: "2026-01-04",
    franqueados: 12,
    faturamentoTotal: detalhesDez25.reduce((s, d) => s + d.faturamento, 0),
    royaltyTotal: detalhesDez25.reduce((s, d) => s + d.royalties, 0),
    marketingTotal: detalhesDez25.reduce((s, d) => s + d.marketing, 0),
    totalCobrado: detalhesDez25.reduce((s, d) => s + d.totalCobrado, 0),
    nfsEmitidas: 12,
    status: "concluido",
    detalhes: detalhesDez25,
  },
  {
    id: "ciclo-nov25",
    competencia: "Nov/2025",
    competenciaShort: "Nov/25",
    dataApuracao: "2025-12-03",
    franqueados: 11,
    faturamentoTotal: detalhesNov25.reduce((s, d) => s + d.faturamento, 0),
    royaltyTotal: detalhesNov25.reduce((s, d) => s + d.royalties, 0),
    marketingTotal: detalhesNov25.reduce((s, d) => s + d.marketing, 0),
    totalCobrado: detalhesNov25.reduce((s, d) => s + d.totalCobrado, 0),
    nfsEmitidas: 11,
    status: "concluido",
    detalhes: detalhesNov25,
  },
  {
    id: "ciclo-out25",
    competencia: "Out/2025",
    competenciaShort: "Out/25",
    dataApuracao: "2025-11-04",
    franqueados: 11,
    faturamentoTotal: detalhesOut25.reduce((s, d) => s + d.faturamento, 0),
    royaltyTotal: detalhesOut25.reduce((s, d) => s + d.royalties, 0),
    marketingTotal: detalhesOut25.reduce((s, d) => s + d.marketing, 0),
    totalCobrado: detalhesOut25.reduce((s, d) => s + d.totalCobrado, 0),
    nfsEmitidas: 11,
    status: "concluido",
    detalhes: detalhesOut25,
  },
  {
    id: "ciclo-set25",
    competencia: "Set/2025",
    competenciaShort: "Set/25",
    dataApuracao: "2025-10-03",
    franqueados: 10,
    faturamentoTotal: detalhesSet25.reduce((s, d) => s + d.faturamento, 0),
    royaltyTotal: detalhesSet25.reduce((s, d) => s + d.royalties, 0),
    marketingTotal: detalhesSet25.reduce((s, d) => s + d.marketing, 0),
    totalCobrado: detalhesSet25.reduce((s, d) => s + d.totalCobrado, 0),
    nfsEmitidas: 10,
    status: "concluido",
    detalhes: detalhesSet25,
  },
];
