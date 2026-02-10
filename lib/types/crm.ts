// Shared types for CRM API responses

// Tipo enriquecido do cliente (substitui Franqueado dummy)
export interface CrmCustomer {
  id: string;
  name: string;
  doc: string;
  email: string;
  phone: string;
  // Métricas calculadas server-side:
  totalEmitido: number; // soma amountCents de todas cobranças
  totalRecebido: number; // soma amountCents de cobranças PAID
  totalAberto: number; // soma amountCents PENDING + OVERDUE
  totalVencido: number; // soma amountCents OVERDUE
  qtdTarefasAbertas: number; // count tasks PENDENTE + EM_ANDAMENTO
  ultimaInteracao: string | null;
  inadimplencia: number; // totalVencido / totalEmitido (0 se nenhum)
  healthStatus: "Saudável" | "Controlado" | "Exige Atenção" | "Crítico";
}

// Interação (alinhado com InteractionLog do Prisma)
export interface CrmInteraction {
  id: string;
  customerId: string;
  customerName: string;
  chargeId?: string | null;
  type: "EMAIL" | "WHATSAPP" | "SMS" | "TELEFONE" | "NOTA_INTERNA";
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  createdBy: string;
  createdById: string;
  createdAt: string;
  isAutomatic?: boolean;
}

// Tarefa (alinhado com CollectionTask do Prisma)
export interface CrmTask {
  id: string;
  customerId: string;
  customerName: string;
  chargeId?: string | null;
  title: string;
  description?: string | null;
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";
  priority: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  dueDate?: string | null;
  assignedTo?: string | null;
  assignedToId?: string | null;
  completedAt?: string | null;
  createdBy: string;
  createdById: string;
  createdAt: string;
}

// Cobrança (alinhado com Charge do Prisma)
export interface CrmCharge {
  id: string;
  customerId: string;
  description: string;
  amountCents: number;
  dueDate: string;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
  createdAt: string;
}

// User resumido (para dropdowns)
export interface TenantUser {
  id: string;
  name: string;
  role: string;
}
