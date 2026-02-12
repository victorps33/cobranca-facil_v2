// Apuração calculation logic — types, defaults, and calculation function
// Extracted from lib/data/apuracao-dummy.ts

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

export interface ExcecaoApuracao {
  franqueadoId: string;
  descricao: string;
}

export interface DescontoApuracao {
  franqueadoId: string;
  descricao: string;
  tipo: "percentual" | "fixo";
  valor: number; // em centavos se fixo, percentual se percentual
  ciclos: number; // 0 = permanente
}

export interface RegraApuracao {
  royaltyPercent: number;
  marketingPercent: number;
  baseCalculo: "bruto" | "liquido";
  exceções: ExcecaoApuracao[];
  descontos: DescontoApuracao[];
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
  desconto: number;       // valor do desconto aplicado em centavos
  totalCobrar: number;
  variacao: number;       // percentual de variação vs mês anterior
  flagRevisao: boolean;   // true se variação > 20%
  nfRoyalty: boolean;
  nfMarketing: boolean;
  temExcecao: boolean;
  temDesconto: boolean;
  excecaoDescricao?: string;
  descontoDescricao?: string;
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
// DEFAULTS
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

export const fontesDefault: FonteDados[] = [
  { id: "pdv", nome: "PDV", unidades: 0, conectado: false },
  { id: "ifood", nome: "iFood", unidades: 0, conectado: false },
  { id: "rappi", nome: "Rappi", unidades: 0, conectado: false },
  { id: "outras", nome: "Outras fontes", unidades: 0, conectado: false },
];

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
    const subtotal = royalty + marketing;

    const variacao = f.mesAnterior > 0
      ? ((faturamento - f.mesAnterior) / f.mesAnterior) * 100
      : 0;

    const flagRevisao = Math.abs(variacao) > 20;

    // Exceção inverte a regra geral para este franqueado
    const isExceçãoRoyalty = nfConfig.exceçõesRoyalty.includes(f.id);
    const isExceçãoMarketing = nfConfig.exceçõesMarketing.includes(f.id);

    // Exceções de regras
    const excecao = regras.exceções.find((e) => e.franqueadoId === f.id);
    const temExcecao = !!excecao;

    // Descontos
    const descontoRegra = regras.descontos.find((d) => d.franqueadoId === f.id);
    let desconto = 0;
    if (descontoRegra) {
      if (descontoRegra.tipo === "percentual") {
        desconto = Math.round(subtotal * (descontoRegra.valor / 100));
      } else {
        desconto = descontoRegra.valor;
      }
    }
    const temDesconto = desconto > 0;
    const totalCobrar = Math.max(0, subtotal - desconto);

    return {
      id: f.id,
      nome: f.nome,
      faturamento,
      royalty,
      marketing,
      desconto,
      totalCobrar,
      variacao: Math.round(variacao),
      flagRevisao,
      nfRoyalty: isExceçãoRoyalty ? !nfConfig.royalty : nfConfig.royalty,
      nfMarketing: isExceçãoMarketing ? !nfConfig.marketing : nfConfig.marketing,
      temExcecao,
      temDesconto,
      excecaoDescricao: excecao?.descricao,
      descontoDescricao: descontoRegra?.descricao,
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
