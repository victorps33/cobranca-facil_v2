// ---------------------------------------------------------------------------
// Omie ERP API types
// ---------------------------------------------------------------------------

export interface OmieCliente {
  codigo_cliente_omie: number;
  codigo_cliente_integracao?: string;
  cnpj_cpf: string;
  razao_social: string;
  nome_fantasia?: string;
  email?: string;
  telefone1_numero?: string;
  cidade?: string;
  estado?: string;
  inativo?: string; // "S" | "N"
}

export interface OmieContaReceber {
  codigo_lancamento_omie: number;
  codigo_lancamento_integracao?: string;
  codigo_cliente_fornecedor: number;
  data_vencimento: string; // dd/MM/yyyy
  valor_documento: number;
  status_titulo: string;
  data_pagamento?: string; // dd/MM/yyyy
  valor_pagamento?: number;
  numero_documento?: string;
}

export interface OmieSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
  boletosFound?: number;
  boletosErrors?: number;
  boletosErrorDetails?: string[];
}

export interface OmieWebhookPayload {
  topic: string;
  event: Record<string, unknown>;
  appKey?: string;
}

export interface OmieBoleto {
  cLinkBoleto: string;
  cCodStatus: string;
  cDesStatus: string;
  dDtEmBol: string;
  cNumBoleto: string;
  cCodBarras: string;
  nPerJuros: number;
  nPerMulta: number;
  cNumBancario: string;
}

// Omie API envelope types
export interface OmieListResponse<T> {
  pagina: number;
  total_de_paginas: number;
  registros: number;
  total_de_registros: number;
  [dataKey: string]: T[] | number;
}
