// ---------------------------------------------------------------------------
// Conta Azul API v2 response types
// Base URL: https://api-v2.contaazul.com/v1/
// ---------------------------------------------------------------------------

// ── New API v2 types ──

export interface ContaAzulV2Paginated<T> {
  itens_totais: number;
  itens: T[];
}

export interface ContaAzulV2Pessoa {
  uuid: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  id_legado?: number;
  uuid_legado?: string;
  perfis: string[]; // ["Cliente"]
  tipo_pessoa: string; // "JURIDICA" | "FISICA"
  data_criacao?: string;
  data_alteracao?: string;
}

export interface ContaAzulV2Receivable {
  id: string;
  status: string; // "PENDING", "OVERDUE", "ACQUITTED", etc.
  status_traduzido: string; // "EM_ABERTO", "VENCIDO", "LIQUIDADO"
  total: number;
  nao_pago: number;
  pago: number;
  descricao: string | null;
  data_vencimento: string; // "2026-03-12"
  data_criacao: string;
  data_alteracao: string;
  data_competencia: string;
  categorias: { id: string; nome: string }[];
  centros_de_custo: unknown[];
  cliente: { id: string; nome: string };
  renegociacao: unknown | null;
}

// ── Legacy types (kept for backward compat with old mappers) ──

export interface ContaAzulCustomer {
  id: string;
  name: string;
  company_name?: string;
  document?: string;
  identity_document?: string;
  email?: string;
  business_phone?: string;
  mobile_phone?: string;
  person_type: "NATURAL" | "LEGAL";
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    zip_code?: string;
    city?: {
      name?: string;
    };
    state?: {
      name?: string;
      abbreviation?: string;
    };
  };
  created_at?: string;
  updated_at?: string;
}

export interface ContaAzulSale {
  id: string;
  number?: number;
  status: string;
  customer_id: string;
  emission?: string;
  due_date?: string;
  total: number;
  total_paid?: number;
  payment?: {
    type?: string;
    installments?: number;
  };
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContaAzulReceivable {
  id: string;
  document_number?: string;
  status: string;
  customer_id: string;
  due_date: string;
  value: number;
  paid_value?: number;
  payment_date?: string;
  description?: string;
  category?: {
    id?: string;
    name?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface ContaAzulService {
  id: string;
  name: string;
  code?: string;
  cost?: number;
}

export interface ContaAzulServiceInvoice {
  id: string;
  protocol_id?: string;
  status: string;
  number?: string;
  service_value: number;
  customer_id: string;
  issue_date?: string;
  pdf_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContaAzulTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface ContaAzulPaginatedResponse<T> {
  data: T[];
  hasNext: boolean;
  nextUrl?: string;
}

export interface ContaAzulError {
  error?: string;
  error_description?: string;
  message?: string;
  status?: number;
  code?: number;
}
