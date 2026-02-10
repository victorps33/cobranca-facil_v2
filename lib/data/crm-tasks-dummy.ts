export interface CrmTask {
  id: string;
  customerId: string;
  customerName: string;
  chargeId?: string;
  title: string;
  description?: string;
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";
  priority: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  dueDate?: string;
  assignedTo?: string;
  assignedToId?: string;
  completedAt?: string;
  createdBy: string;
  createdById: string;
  createdAt: string;
}

export const TASK_STATUS_LABELS: Record<CrmTask["status"], string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em Andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const TASK_STATUS_COLORS: Record<CrmTask["status"], string> = {
  PENDENTE: "bg-yellow-50 text-yellow-700",
  EM_ANDAMENTO: "bg-blue-50 text-blue-700",
  CONCLUIDA: "bg-emerald-50 text-emerald-700",
  CANCELADA: "bg-gray-100 text-gray-500",
};

export const TASK_PRIORITY_LABELS: Record<CrmTask["priority"], string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

export const TASK_PRIORITY_COLORS: Record<CrmTask["priority"], string> = {
  BAIXA: "bg-gray-100 text-gray-600",
  MEDIA: "bg-blue-50 text-blue-700",
  ALTA: "bg-amber-50 text-amber-700",
  CRITICA: "bg-red-50 text-red-700",
};

// Dummy user IDs
const USR_ADM = "usr-adm-001";
const USR_FIN = "usr-fin-001";
const USR_OPE = "usr-ope-001";

export const tasksDummy: CrmTask[] = [
  // ── Franquia Recife (Crítico) ──
  {
    id: "task-001",
    customerId: "c7890123-4567-8901-0123-789012345678",
    customerName: "Franquia Recife",
    title: "Encaminhar débito para jurídico",
    description: "Total devedor: R$ 28.500,00. Loja fechada. Sem contato desde Jan/2026. Preparar documentação para cobrança judicial.",
    status: "PENDENTE",
    priority: "CRITICA",
    dueDate: "2026-02-15",
    assignedTo: "João Financeiro",
    assignedToId: USR_FIN,
    createdBy: "Admin Menlo",
    createdById: USR_ADM,
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "task-002",
    customerId: "c7890123-4567-8901-0123-789012345678",
    customerName: "Franquia Recife",
    title: "Tentar contato final com Paulo Henrique",
    description: "Última tentativa de negociação antes de encaminhar ao jurídico.",
    status: "CONCLUIDA",
    priority: "ALTA",
    dueDate: "2026-01-10",
    assignedTo: "Maria Operacional",
    assignedToId: USR_OPE,
    completedAt: "2026-01-05T10:15:00Z",
    createdBy: "João Financeiro",
    createdById: USR_FIN,
    createdAt: "2025-12-20T09:00:00Z",
  },
  {
    id: "task-003",
    customerId: "c7890123-4567-8901-0123-789012345678",
    customerName: "Franquia Recife",
    title: "Verificar status do distrato",
    description: "Confirmar se o processo de distrato foi iniciado junto ao comercial.",
    status: "EM_ANDAMENTO",
    priority: "ALTA",
    dueDate: "2026-02-10",
    assignedTo: "Admin Menlo",
    assignedToId: USR_ADM,
    createdBy: "João Financeiro",
    createdById: USR_FIN,
    createdAt: "2026-01-20T14:00:00Z",
  },

  // ── Franquia Fortaleza (Crítico) ──
  {
    id: "task-004",
    customerId: "c8901234-5678-9012-1234-890123456789",
    customerName: "Franquia Fortaleza",
    title: "Acompanhar pagamento parcial de R$ 5.000",
    description: "Juliana prometeu pagamento parcial. Verificar se foi creditado e atualizar cobranças.",
    status: "EM_ANDAMENTO",
    priority: "ALTA",
    dueDate: "2026-01-17",
    assignedTo: "João Financeiro",
    assignedToId: USR_FIN,
    createdBy: "Maria Operacional",
    createdById: USR_OPE,
    createdAt: "2026-01-10T15:00:00Z",
  },
  {
    id: "task-005",
    customerId: "c8901234-5678-9012-1234-890123456789",
    customerName: "Franquia Fortaleza",
    title: "Enviar proposta de parcelamento",
    description: "Preparar proposta de parcelamento do saldo restante em até 6x. Encaminhar para aprovação.",
    status: "PENDENTE",
    priority: "ALTA",
    dueDate: "2026-02-12",
    assignedTo: "João Financeiro",
    assignedToId: USR_FIN,
    createdBy: "Admin Menlo",
    createdById: USR_ADM,
    createdAt: "2026-01-20T10:00:00Z",
  },

  // ── Franquia Campo Belo (Exige Atenção) ──
  {
    id: "task-006",
    customerId: "c4d5e6f7-8901-2345-def0-456789012345",
    customerName: "Franquia Campo Belo",
    title: "Ligar para Fernanda sobre atraso recorrente",
    description: "Fernanda tem atrasos frequentes (PMR 28 dias). Sugerir pagamento antecipado com desconto.",
    status: "PENDENTE",
    priority: "MEDIA",
    dueDate: "2026-02-14",
    assignedTo: "Maria Operacional",
    assignedToId: USR_OPE,
    createdBy: "João Financeiro",
    createdById: USR_FIN,
    createdAt: "2026-01-18T11:00:00Z",
  },
  {
    id: "task-007",
    customerId: "c4d5e6f7-8901-2345-def0-456789012345",
    customerName: "Franquia Campo Belo",
    title: "Atualizar dados cadastrais",
    description: "E-mail retornando bounce. Solicitar novo e-mail de contato.",
    status: "CONCLUIDA",
    priority: "BAIXA",
    dueDate: "2026-01-20",
    assignedTo: "Maria Operacional",
    assignedToId: USR_OPE,
    completedAt: "2026-01-18T16:00:00Z",
    createdBy: "Admin Menlo",
    createdById: USR_ADM,
    createdAt: "2026-01-10T09:00:00Z",
  },

  // ── Franquia Salvador (Exige Atenção) ──
  {
    id: "task-008",
    customerId: "c9012345-6789-0123-2345-901234567890",
    customerName: "Franquia Salvador",
    title: "Cobrar Royalties Jan/2026",
    description: "Vencimento em 02/02. Marcos pediu 2ª via do boleto. Verificar se pagou.",
    status: "PENDENTE",
    priority: "MEDIA",
    dueDate: "2026-02-09",
    assignedTo: "Maria Operacional",
    assignedToId: USR_OPE,
    createdBy: "João Financeiro",
    createdById: USR_FIN,
    createdAt: "2026-02-03T12:00:00Z",
  },

  // ── Franquia Manaus (Exige Atenção) ──
  {
    id: "task-009",
    customerId: "cd456789-0123-4567-6789-345678901234",
    customerName: "Franquia Manaus",
    title: "Investigar situação da franquia",
    description: "Loja fechada. Thiago sem resposta. Verificar com comercial se houve distrato ou abandono.",
    status: "EM_ANDAMENTO",
    priority: "CRITICA",
    dueDate: "2026-02-07",
    assignedTo: "Admin Menlo",
    assignedToId: USR_ADM,
    createdBy: "Admin Menlo",
    createdById: USR_ADM,
    createdAt: "2026-01-28T14:30:00Z",
  },

  // ── Franquia Vila Mariana (Controlado) ──
  {
    id: "task-010",
    customerId: "c2b3c4d5-e6f7-8901-bcde-f23456789012",
    customerName: "Franquia Vila Mariana",
    title: "Acompanhar pagamento FNP Dez/2025",
    description: "Ana Beatriz informou que pagará na próxima semana. Acompanhar.",
    status: "CONCLUIDA",
    priority: "MEDIA",
    dueDate: "2026-01-27",
    assignedTo: "Maria Operacional",
    assignedToId: USR_OPE,
    completedAt: "2026-01-26T14:00:00Z",
    createdBy: "Maria Operacional",
    createdById: USR_OPE,
    createdAt: "2026-01-20T15:30:00Z",
  },

  // ── Franquia Curitiba (Controlado) ──
  {
    id: "task-011",
    customerId: "ca123456-7890-1234-3456-012345678901",
    customerName: "Franquia Curitiba",
    title: "Enviar boleto atualizado Royalties Jan/2026",
    description: "Patrícia solicitou boleto com nova data de vencimento.",
    status: "CONCLUIDA",
    priority: "BAIXA",
    dueDate: "2026-02-05",
    assignedTo: "João Financeiro",
    assignedToId: USR_FIN,
    completedAt: "2026-02-04T11:30:00Z",
    createdBy: "Maria Operacional",
    createdById: USR_OPE,
    createdAt: "2026-02-03T09:00:00Z",
  },

  // ── Franquia Morumbi (Saudável) ──
  {
    id: "task-012",
    customerId: "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
    customerName: "Franquia Morumbi",
    title: "Revisar contrato de renovação",
    description: "Contrato vence em Mar/2026. Preparar proposta de renovação com novos termos.",
    status: "PENDENTE",
    priority: "BAIXA",
    dueDate: "2026-03-01",
    assignedTo: "Admin Menlo",
    assignedToId: USR_ADM,
    createdBy: "Admin Menlo",
    createdById: USR_ADM,
    createdAt: "2026-02-01T09:00:00Z",
  },

  // ── Franquia Porto Alegre (Controlado) ──
  {
    id: "task-013",
    customerId: "cb234567-8901-2345-4567-123456789012",
    customerName: "Franquia Porto Alegre",
    title: "Conferir repasse pós-venda",
    description: "Franquia vendida. Verificar se há débitos pendentes do antigo franqueado.",
    status: "EM_ANDAMENTO",
    priority: "MEDIA",
    dueDate: "2026-02-20",
    assignedTo: "João Financeiro",
    assignedToId: USR_FIN,
    createdBy: "Admin Menlo",
    createdById: USR_ADM,
    createdAt: "2026-01-25T10:00:00Z",
  },

  // ── Tarefas canceladas ──
  {
    id: "task-014",
    customerId: "c8901234-5678-9012-1234-890123456789",
    customerName: "Franquia Fortaleza",
    title: "Enviar notificação extrajudicial",
    description: "Cancelado pois Juliana entrou em contato e negociou pagamento parcial.",
    status: "CANCELADA",
    priority: "ALTA",
    dueDate: "2026-01-15",
    assignedTo: "Admin Menlo",
    assignedToId: USR_ADM,
    createdBy: "João Financeiro",
    createdById: USR_FIN,
    createdAt: "2025-12-28T10:00:00Z",
  },

  // ── Mais uma tarefa genérica ──
  {
    id: "task-015",
    customerId: "cc345678-9012-3456-5678-234567890123",
    customerName: "Franquia Belo Horizonte",
    title: "Enviar relatório de adimplência",
    description: "Renata solicitou relatório de pagamentos do último semestre.",
    status: "PENDENTE",
    priority: "BAIXA",
    dueDate: "2026-02-18",
    assignedTo: "Maria Operacional",
    assignedToId: USR_OPE,
    createdBy: "Admin Menlo",
    createdById: USR_ADM,
    createdAt: "2026-02-05T10:00:00Z",
  },
  {
    id: "task-016",
    customerId: "c3c4d5e6-f789-0123-cdef-345678901234",
    customerName: "Franquia Santo Amaro",
    title: "Parabenizar pela adimplência",
    description: "Cliente 100% em dia. Enviar reconhecimento e oferecer benefícios.",
    status: "PENDENTE",
    priority: "BAIXA",
    dueDate: "2026-02-28",
    assignedTo: "Maria Operacional",
    assignedToId: USR_OPE,
    createdBy: "Admin Menlo",
    createdById: USR_ADM,
    createdAt: "2026-02-06T09:00:00Z",
  },
];

export function getTasksStats(tasks: CrmTask[]) {
  const hoje = new Date();
  const pendentes = tasks.filter((t) => t.status === "PENDENTE").length;
  const emAndamento = tasks.filter((t) => t.status === "EM_ANDAMENTO").length;
  const concluidas = tasks.filter((t) => t.status === "CONCLUIDA").length;
  const canceladas = tasks.filter((t) => t.status === "CANCELADA").length;
  const atrasadas = tasks.filter(
    (t) =>
      t.dueDate &&
      new Date(t.dueDate) < hoje &&
      (t.status === "PENDENTE" || t.status === "EM_ANDAMENTO")
  ).length;

  return { pendentes, emAndamento, concluidas, canceladas, atrasadas };
}
