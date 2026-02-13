// Shared CRM constants — labels, colors, and helpers
// Types come from @/lib/types/crm

import type { CrmInteraction, CrmTask } from "@/lib/types/crm";

// ── Interaction constants ──

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
  SMS: "bg-blue-50 text-blue-700",
  TELEFONE: "bg-amber-50 text-amber-700",
  NOTA_INTERNA: "bg-gray-100 text-gray-700",
};

export const DIRECTION_LABELS: Record<CrmInteraction["direction"], string> = {
  INBOUND: "Recebido",
  OUTBOUND: "Enviado",
};

// ── Task constants ──

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

// ── Task helpers ──

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
