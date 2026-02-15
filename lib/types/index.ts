// ---------------------------------------------------------------------------
// Shared types (formerly defined inside dummy data files)
// ---------------------------------------------------------------------------

export interface Franqueado {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  email: string;
  telefone: string;
  cidade: string;
  estado: string;
  bairro: string;
  dataAbertura: string;
  responsavel: string;
  statusLoja: "Aberta" | "Fechada" | "Vendida";
  valorEmitido: number;
  valorRecebido: number;
  valorAberto: number;
  inadimplencia: number;
  status: "Saudável" | "Controlado" | "Exige Atenção" | "Crítico";
  pmr: number;
}

export interface Cobranca {
  id: string;
  cliente: string;
  clienteId: string;
  categoria: "Royalties" | "FNP" | "Taxa de Franquia" | "Produto" | "Serviço";
  descricao: string;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento?: string;
  valorOriginal: number;
  valorPago: number;
  valorAberto: number;
  formaPagamento: "Boleto" | "Pix" | "Cartão";
  status: "Aberta" | "Vencida" | "Paga" | "Cancelada" | "Parcial";
  nfEmitida: boolean;
  competencia: string;
}

export interface ApuracaoDetalhe {
  franqueado: string;
  pdv: number;
  ifood: number;
  rappi: number;
  faturamento: number;
  royalties: number;
  marketing: number;
  totalCobrado: number;
  nfEmitida: boolean;
}

export interface ApuracaoCiclo {
  id: string;
  competencia: string;
  competenciaShort: string;
  dataApuracao: string;
  franqueados: number;
  faturamentoTotal: number;
  royaltyTotal: number;
  marketingTotal: number;
  totalCobrado: number;
  nfsEmitidas: number;
  status: "concluido";
  detalhes: ApuracaoDetalhe[];
}

export interface CobrancasStats {
  total: number;
  totalEmitido: number;
  totalPago: number;
  totalAberto: number;
  valorVencido: number;
  byStatus: {
    aberta: number;
    vencida: number;
    paga: number;
    cancelada: number;
  };
  byCategoria: {
    royalties: number;
    fnp: number;
    taxaFranquia: number;
  };
  byFormaPagamento: {
    boleto: number;
    pix: number;
    cartao: number;
  };
  taxaRecebimento: number;
}
