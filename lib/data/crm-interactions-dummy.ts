export interface CrmInteraction {
  id: string;
  customerId: string;
  customerName: string;
  chargeId?: string;
  type: "EMAIL" | "WHATSAPP" | "SMS" | "TELEFONE" | "NOTA_INTERNA";
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  createdBy: string;
  createdById: string;
  createdAt: string;
  isAutomatic?: boolean;
}

export const INTERACTION_TYPE_LABELS: Record<CrmInteraction["type"], string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  TELEFONE: "Telefone",
  NOTA_INTERNA: "Nota Interna",
};

export const INTERACTION_TYPE_COLORS: Record<CrmInteraction["type"], string> = {
  EMAIL: "bg-blue-50 text-blue-700",
  WHATSAPP: "bg-green-50 text-green-700",
  SMS: "bg-purple-50 text-purple-700",
  TELEFONE: "bg-amber-50 text-amber-700",
  NOTA_INTERNA: "bg-gray-100 text-gray-700",
};

export const DIRECTION_LABELS: Record<CrmInteraction["direction"], string> = {
  INBOUND: "Recebido",
  OUTBOUND: "Enviado",
};

// Dummy user IDs
const USR_ADM = "usr-adm-001";
const USR_FIN = "usr-fin-001";
const USR_OPE = "usr-ope-001";

export const interactionsDummy: CrmInteraction[] = [
  // ── Franquia Recife (Crítico) — mais interações ──
  {
    id: "int-001",
    customerId: "c7890123-4567-8901-0123-789012345678",
    customerName: "Franquia Recife",
    type: "EMAIL",
    direction: "OUTBOUND",
    content: "Enviado lembrete de cobrança referente a Royalties Nov/2025. Valor: R$ 4.250,00.",
    createdBy: "Sistema",
    createdById: USR_ADM,
    createdAt: "2025-12-02T09:00:00Z",
    isAutomatic: true,
  },
  {
    id: "int-002",
    customerId: "c7890123-4567-8901-0123-789012345678",
    customerName: "Franquia Recife",
    type: "WHATSAPP",
    direction: "OUTBOUND",
    content: "Régua D+3: Cobrança de Royalties Nov/2025 vencida. Solicitado contato.",
    createdBy: "Sistema",
    createdById: USR_ADM,
    createdAt: "2025-12-05T10:30:00Z",
    isAutomatic: true,
  },
  {
    id: "int-003",
    customerId: "c7890123-4567-8901-0123-789012345678",
    customerName: "Franquia Recife",
    type: "TELEFONE",
    direction: "OUTBOUND",
    content: "Ligação para Paulo Henrique. Informou dificuldades financeiras após fechamento da loja. Solicitou parcelamento em 3x. Encaminhado para análise do financeiro.",
    createdBy: "Maria Operacional",
    createdById: USR_OPE,
    createdAt: "2025-12-08T14:20:00Z",
  },
  {
    id: "int-004",
    customerId: "c7890123-4567-8901-0123-789012345678",
    customerName: "Franquia Recife",
    type: "EMAIL",
    direction: "INBOUND",
    content: "Recebi o e-mail. Gostaria de negociar o débito. Podemos agendar uma reunião?",
    createdBy: "Paulo Henrique Alves",
    createdById: USR_OPE,
    createdAt: "2025-12-10T16:00:00Z",
  },
  {
    id: "int-005",
    customerId: "c7890123-4567-8901-0123-789012345678",
    customerName: "Franquia Recife",
    type: "NOTA_INTERNA",
    direction: "OUTBOUND",
    content: "Cliente em situação crítica. Loja fechada desde Nov/2025. Total devedor: R$ 28.500,00. Recomendo encaminhar para jurídico caso não haja acordo até 15/01.",
    createdBy: "João Financeiro",
    createdById: USR_FIN,
    createdAt: "2025-12-12T11:00:00Z",
  },
  {
    id: "int-006",
    customerId: "c7890123-4567-8901-0123-789012345678",
    customerName: "Franquia Recife",
    type: "WHATSAPP",
    direction: "OUTBOUND",
    content: "Régua D+7: Segundo aviso de cobrança FNP Nov/2025. Valor: R$ 2.100,00.",
    createdBy: "Sistema",
    createdById: USR_ADM,
    createdAt: "2025-12-15T09:00:00Z",
    isAutomatic: true,
  },
  {
    id: "int-007",
    customerId: "c7890123-4567-8901-0123-789012345678",
    customerName: "Franquia Recife",
    type: "TELEFONE",
    direction: "OUTBOUND",
    content: "Nova tentativa de contato. Sem resposta. Deixado recado na caixa postal.",
    createdBy: "Maria Operacional",
    createdById: USR_OPE,
    createdAt: "2026-01-05T10:15:00Z",
  },

  // ── Franquia Fortaleza (Crítico) ──
  {
    id: "int-008",
    customerId: "c8901234-5678-9012-1234-890123456789",
    customerName: "Franquia Fortaleza",
    type: "EMAIL",
    direction: "OUTBOUND",
    content: "Enviado lembrete de cobrança referente a Royalties Out/2025. Valor: R$ 3.800,00.",
    createdBy: "Sistema",
    createdById: USR_ADM,
    createdAt: "2025-11-10T09:00:00Z",
    isAutomatic: true,
  },
  {
    id: "int-009",
    customerId: "c8901234-5678-9012-1234-890123456789",
    customerName: "Franquia Fortaleza",
    type: "WHATSAPP",
    direction: "INBOUND",
    content: "Boa tarde, vi o e-mail. Estamos passando por reestruturação. Vou pagar até semana que vem.",
    createdBy: "Juliana Ribeiro",
    createdById: USR_OPE,
    createdAt: "2025-11-12T15:30:00Z",
  },
  {
    id: "int-010",
    customerId: "c8901234-5678-9012-1234-890123456789",
    customerName: "Franquia Fortaleza",
    type: "SMS",
    direction: "OUTBOUND",
    content: "Régua D+3: Lembrete automático de pagamento pendente - Royalties Out/2025.",
    createdBy: "Sistema",
    createdById: USR_ADM,
    createdAt: "2025-11-18T08:00:00Z",
    isAutomatic: true,
  },
  {
    id: "int-011",
    customerId: "c8901234-5678-9012-1234-890123456789",
    customerName: "Franquia Fortaleza",
    type: "NOTA_INTERNA",
    direction: "OUTBOUND",
    content: "Juliana prometeu pagamento para semana seguinte, mas não cumpriu. Agendar nova cobrança.",
    createdBy: "João Financeiro",
    createdById: USR_FIN,
    createdAt: "2025-11-25T11:00:00Z",
  },
  {
    id: "int-012",
    customerId: "c8901234-5678-9012-1234-890123456789",
    customerName: "Franquia Fortaleza",
    type: "TELEFONE",
    direction: "OUTBOUND",
    content: "Contato com Juliana. Informou que pagará parcialmente R$ 5.000 esta semana. Resto no mês seguinte.",
    createdBy: "Maria Operacional",
    createdById: USR_OPE,
    createdAt: "2026-01-10T14:00:00Z",
  },

  // ── Franquia Campo Belo (Exige Atenção) ──
  {
    id: "int-013",
    customerId: "c4d5e6f7-8901-2345-def0-456789012345",
    customerName: "Franquia Campo Belo",
    type: "EMAIL",
    direction: "OUTBOUND",
    content: "Lembrete de cobrança - FNP Dez/2025. Valor: R$ 1.850,00. Vencimento: 15/01/2026.",
    createdBy: "Sistema",
    createdById: USR_ADM,
    createdAt: "2026-01-10T09:00:00Z",
    isAutomatic: true,
  },
  {
    id: "int-014",
    customerId: "c4d5e6f7-8901-2345-def0-456789012345",
    customerName: "Franquia Campo Belo",
    type: "WHATSAPP",
    direction: "INBOUND",
    content: "Recebi o boleto. Vou pagar amanhã. Obrigada!",
    createdBy: "Fernanda Oliveira",
    createdById: USR_OPE,
    createdAt: "2026-01-12T17:00:00Z",
  },
  {
    id: "int-015",
    customerId: "c4d5e6f7-8901-2345-def0-456789012345",
    customerName: "Franquia Campo Belo",
    type: "NOTA_INTERNA",
    direction: "OUTBOUND",
    content: "Fernanda tem histórico de atrasos mas sempre paga. PMR de 28 dias. Manter acompanhamento normal.",
    createdBy: "João Financeiro",
    createdById: USR_FIN,
    createdAt: "2026-01-15T10:00:00Z",
  },

  // ── Franquia Salvador (Exige Atenção) ──
  {
    id: "int-016",
    customerId: "c9012345-6789-0123-2345-901234567890",
    customerName: "Franquia Salvador",
    type: "SMS",
    direction: "OUTBOUND",
    content: "Régua D-1: Lembrete de vencimento amanhã - Royalties Jan/2026. Valor: R$ 3.400,00.",
    createdBy: "Sistema",
    createdById: USR_ADM,
    createdAt: "2026-02-01T08:00:00Z",
    isAutomatic: true,
  },
  {
    id: "int-017",
    customerId: "c9012345-6789-0123-2345-901234567890",
    customerName: "Franquia Salvador",
    type: "TELEFONE",
    direction: "INBOUND",
    content: "Marcos ligou pedindo segunda via do boleto de Royalties Jan/2026. Enviado por e-mail.",
    createdBy: "Maria Operacional",
    createdById: USR_OPE,
    createdAt: "2026-02-03T11:30:00Z",
  },

  // ── Franquia Manaus (Exige Atenção) ──
  {
    id: "int-018",
    customerId: "cd456789-0123-4567-6789-345678901234",
    customerName: "Franquia Manaus",
    type: "EMAIL",
    direction: "OUTBOUND",
    content: "Cobrança de Royalties Dez/2025 vencida há 15 dias. Valor: R$ 2.600,00. Regularize o quanto antes.",
    createdBy: "Sistema",
    createdById: USR_ADM,
    createdAt: "2026-01-20T09:00:00Z",
    isAutomatic: true,
  },
  {
    id: "int-019",
    customerId: "cd456789-0123-4567-6789-345678901234",
    customerName: "Franquia Manaus",
    type: "NOTA_INTERNA",
    direction: "OUTBOUND",
    content: "Loja fechada. Thiago não responde desde Dez/2025. Verificar se houve distrato.",
    createdBy: "Admin Menlo",
    createdById: USR_ADM,
    createdAt: "2026-01-28T14:00:00Z",
  },

  // ── Franquia Morumbi (Saudável) — poucas interações ──
  {
    id: "int-020",
    customerId: "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
    customerName: "Franquia Morumbi",
    type: "EMAIL",
    direction: "OUTBOUND",
    content: "Régua D-5: Lembrete de vencimento - Royalties Jan/2026. Valor: R$ 7.125,00.",
    createdBy: "Sistema",
    createdById: USR_ADM,
    createdAt: "2026-01-27T09:00:00Z",
    isAutomatic: true,
  },
  {
    id: "int-021",
    customerId: "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
    customerName: "Franquia Morumbi",
    type: "WHATSAPP",
    direction: "INBOUND",
    content: "Tudo certo, pagamento agendado para dia 01/02. Obrigado!",
    createdBy: "Carlos Mendes",
    createdById: USR_OPE,
    createdAt: "2026-01-28T10:00:00Z",
  },

  // ── Franquia Vila Mariana (Controlado) ──
  {
    id: "int-022",
    customerId: "c2b3c4d5-e6f7-8901-bcde-f23456789012",
    customerName: "Franquia Vila Mariana",
    type: "TELEFONE",
    direction: "OUTBOUND",
    content: "Contato com Ana Beatriz sobre FNP Dez/2025 em atraso. Informou que pagará na próxima semana.",
    createdBy: "Maria Operacional",
    createdById: USR_OPE,
    createdAt: "2026-01-20T15:00:00Z",
  },
  {
    id: "int-023",
    customerId: "c2b3c4d5-e6f7-8901-bcde-f23456789012",
    customerName: "Franquia Vila Mariana",
    type: "WHATSAPP",
    direction: "OUTBOUND",
    content: "Régua D+7: Cobrança FNP Dez/2025 segue pendente. Valor: R$ 1.320,00.",
    createdBy: "Sistema",
    createdById: USR_ADM,
    createdAt: "2026-01-25T09:00:00Z",
    isAutomatic: true,
  },

  // ── Franquia Curitiba (Controlado) ──
  {
    id: "int-024",
    customerId: "ca123456-7890-1234-3456-012345678901",
    customerName: "Franquia Curitiba",
    type: "EMAIL",
    direction: "OUTBOUND",
    content: "Enviado boleto atualizado de Royalties Jan/2026 conforme solicitação.",
    createdBy: "João Financeiro",
    createdById: USR_FIN,
    createdAt: "2026-02-04T11:00:00Z",
  },
];
