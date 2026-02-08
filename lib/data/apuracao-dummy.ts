// ============================================
// INTERFACES
// ============================================

export interface ApuracaoFranqueado {
  id: string;
  nome: string;
  pdv: number;       // faturamento PDV em centavos
  ifood: number;     // faturamento iFood em centavos
  rappiw: number;    // faturamento Rappi em centavos
  total: number;     // faturamento total em centavos
  mesAnterior: number; // faturamento do mês anterior (para cálculo de variação)
  status: "ok" | "alerta"; // alerta se variação > 20%
}

export interface RegraApuracao {
  royaltyPercent: number;
  marketingPercent: number;
  baseCalculo: "bruto" | "liquido";
  exceções: { franqueadoId: string; descricao: string }[];
  descontos: { franqueadoId: string; descricao: string; valor: number }[];
}

export interface NfConfig {
  royalty: boolean;   // emitir NF para royalties?
  marketing: boolean; // emitir NF para marketing/FNP?
  exceçõesRoyalty: string[];   // IDs de franqueados com regra invertida para royalties
  exceçõesMarketing: string[]; // IDs de franqueados com regra invertida para marketing
}

export interface ResultadoFranqueado {
  id: string;
  nome: string;
  faturamento: number;
  royalty: number;
  marketing: number;
  totalCobrar: number;
  variacao: number;      // percentual de variação vs mês anterior
  flagRevisao: boolean;  // true se variação > 20%
  nfRoyalty: boolean;
  nfMarketing: boolean;
}

export interface FonteDados {
  id: string;
  nome: string;
  unidades: number;
  conectado: boolean;
}

export interface ApuracaoState {
  currentStep: number;
  fontes: FonteDados[];
  franqueados: ApuracaoFranqueado[];
  regras: RegraApuracao;
  resultados: ResultadoFranqueado[];
  aprovacao: { revisou: boolean; verificou: boolean; confirmou: boolean };
  emissao: {
    vencimento: string;
    boleto: boolean;
    pix: boolean;
    emailNotif: boolean;
    whatsappNotif: boolean;
  };
  emitido: boolean;
}

// ============================================
// DADOS DUMMY — FONTES DE DADOS
// ============================================

export const fontesDummy: FonteDados[] = [
  { id: "pdv", nome: "PDV", unidades: 45, conectado: true },
  { id: "ifood", nome: "iFood", unidades: 42, conectado: true },
  { id: "rappi", nome: "Rappi", unidades: 0, conectado: false },
  { id: "outras", nome: "Outras fontes", unidades: 0, conectado: false },
];

// ============================================
// DADOS DUMMY — FRANQUEADOS
// ============================================

export const franqueadosDummy: ApuracaoFranqueado[] = [
  { id: "f1", nome: "Franquia Morumbi",        pdv: 18500000, ifood: 4200000, rappiw: 0, total: 22700000, mesAnterior: 21500000, status: "ok" },
  { id: "f2", nome: "Franquia Vila Mariana",    pdv: 14200000, ifood: 3800000, rappiw: 0, total: 18000000, mesAnterior: 17200000, status: "ok" },
  { id: "f3", nome: "Franquia Santo Amaro",     pdv: 11800000, ifood: 2900000, rappiw: 0, total: 14700000, mesAnterior: 14000000, status: "ok" },
  { id: "f4", nome: "Franquia Campo Belo",      pdv: 9500000,  ifood: 2100000, rappiw: 0, total: 11600000, mesAnterior: 11200000, status: "ok" },
  { id: "f5", nome: "Franquia Itaim Bibi",      pdv: 21000000, ifood: 5500000, rappiw: 0, total: 26500000, mesAnterior: 20000000, status: "alerta" },
  { id: "f6", nome: "Franquia Moema",           pdv: 7800000,  ifood: 1900000, rappiw: 0, total: 9700000,  mesAnterior: 13000000, status: "alerta" },
  { id: "f7", nome: "Franquia Brooklin",        pdv: 15600000, ifood: 4100000, rappiw: 0, total: 19700000, mesAnterior: 18800000, status: "ok" },
  { id: "f8", nome: "Franquia Saude",           pdv: 6200000,  ifood: 1500000, rappiw: 0, total: 7700000,  mesAnterior: 7400000,  status: "ok" },
  { id: "f9", nome: "Franquia Recife",          pdv: 8900000,  ifood: 2200000, rappiw: 0, total: 11100000, mesAnterior: 10800000, status: "ok" },
  { id: "f10", nome: "Franquia Fortaleza",      pdv: 7600000,  ifood: 1800000, rappiw: 0, total: 9400000,  mesAnterior: 9100000,  status: "ok" },
  { id: "f11", nome: "Franquia Salvador",       pdv: 6800000,  ifood: 1600000, rappiw: 0, total: 8400000,  mesAnterior: 8100000,  status: "ok" },
  { id: "f12", nome: "Franquia Curitiba",       pdv: 9350000,  ifood: 2400000, rappiw: 0, total: 11750000, mesAnterior: 11200000, status: "ok" },
];

// ============================================
// REGRAS DEFAULT
// ============================================

export const regrasDefault: RegraApuracao = {
  royaltyPercent: 5,
  marketingPercent: 2,
  baseCalculo: "bruto",
  exceções: [],
  descontos: [],
};

export const nfConfigDefault: NfConfig = {
  royalty: true,
  marketing: false,
  exceçõesRoyalty: [],
  exceçõesMarketing: [],
};

// ============================================
// CÁLCULO DE APURAÇÃO
// ============================================

export function calcularApuracao(
  franqueados: ApuracaoFranqueado[],
  regras: RegraApuracao,
  nfConfig: NfConfig = nfConfigDefault
): ResultadoFranqueado[] {
  return franqueados.map((f) => {
    const faturamento = f.total;
    const royalty = Math.round(faturamento * (regras.royaltyPercent / 100));
    const marketing = Math.round(faturamento * (regras.marketingPercent / 100));
    const totalCobrar = royalty + marketing;

    const variacao = f.mesAnterior > 0
      ? ((faturamento - f.mesAnterior) / f.mesAnterior) * 100
      : 0;

    const flagRevisao = Math.abs(variacao) > 20;

    // Exceção inverte a regra geral para este franqueado
    const isExceçãoRoyalty = nfConfig.exceçõesRoyalty.includes(f.id);
    const isExceçãoMarketing = nfConfig.exceçõesMarketing.includes(f.id);

    return {
      id: f.id,
      nome: f.nome,
      faturamento,
      royalty,
      marketing,
      totalCobrar,
      variacao: Math.round(variacao),
      flagRevisao,
      nfRoyalty: isExceçãoRoyalty ? !nfConfig.royalty : nfConfig.royalty,
      nfMarketing: isExceçãoMarketing ? !nfConfig.marketing : nfConfig.marketing,
    };
  });
}

// ============================================
// HELPERS
// ============================================

export function getCompetenciaAtual(): string {
  const now = new Date();
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[now.getMonth()]}/${now.getFullYear()}`;
}

export function getDiasParaEmissao(): number {
  const now = new Date();
  const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.max(0, fimMes.getDate() - now.getDate());
}

export function getCompetenciasDisponiveis(): { label: string; value: string }[] {
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const now = new Date();
  const result: { label: string; value: string; _ts: number }[] = [];

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mes = meses[d.getMonth()];
    const ano = d.getFullYear();
    const anoShort = String(ano).slice(2);
    result.push({
      label: `${mes}/${anoShort}`,
      value: `${mes}/${ano}`,
      _ts: d.getTime(),
    });
  }

  // mais recente primeiro
  result.sort((a, b) => b._ts - a._ts);

  return result.map(({ label, value }) => ({ label, value }));
}
