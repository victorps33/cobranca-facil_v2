import * as XLSX from "xlsx";
import type { CrmInteraction } from "@/lib/data/crm-interactions-dummy";
import type { CrmTask } from "@/lib/data/crm-tasks-dummy";
import {
  INTERACTION_TYPE_LABELS,
  DIRECTION_LABELS,
} from "@/lib/data/crm-interactions-dummy";
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/lib/data/crm-tasks-dummy";

function centsToReais(cents: number): number {
  return cents / 100;
}

const fmtDate = (dateStr: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr));

// ── CRM Clients Export ──

interface CrmClientRow {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  status: string;
  valorAberto: number;
  totalVencido: number;
  qtdTarefasAbertas: number;
  ultimaInteracao: string | null;
}

export function exportCrmClientsToXlsx(clients: CrmClientRow[]) {
  const data = clients.map((c) => ({
    "Cliente": c.nome,
    "Razão Social": c.razaoSocial,
    "CNPJ": c.cnpj,
    "Saúde": c.status,
    "Dívida Total (R$)": centsToReais(c.valorAberto),
    "Valor Vencido (R$)": centsToReais(c.totalVencido),
    "Tarefas Abertas": c.qtdTarefasAbertas,
    "Última Interação": c.ultimaInteracao ? fmtDate(c.ultimaInteracao) : "—",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "CRM Clientes");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `crm_clientes_${today}.xlsx`);
}

// ── Tasks Export ──

export function exportTasksToXlsx(tasks: CrmTask[]) {
  const data = tasks.map((t) => ({
    "Tarefa": t.title,
    "Descrição": t.description ?? "",
    "Cliente": t.customerName,
    "Prioridade": TASK_PRIORITY_LABELS[t.priority],
    "Status": TASK_STATUS_LABELS[t.status],
    "Responsável": t.assignedTo ?? "—",
    "Vencimento": t.dueDate ? fmtDate(t.dueDate) : "—",
    "Concluída em": t.completedAt ? fmtDate(t.completedAt) : "—",
    "Criada por": t.createdBy,
    "Criada em": fmtDate(t.createdAt),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tarefas");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `tarefas_${today}.xlsx`);
}

// ── Interactions Export ──

export function exportInteractionsToXlsx(interactions: CrmInteraction[], customerName?: string) {
  const data = interactions.map((i) => ({
    "Cliente": i.customerName,
    "Tipo": INTERACTION_TYPE_LABELS[i.type],
    "Direção": DIRECTION_LABELS[i.direction],
    "Conteúdo": i.content,
    "Automático": i.isAutomatic ? "Sim" : "Não",
    "Criada por": i.createdBy,
    "Data": fmtDate(i.createdAt),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Interações");

  const today = new Date().toISOString().slice(0, 10);
  const suffix = customerName ? `_${customerName.replace(/\s+/g, "_")}` : "";
  XLSX.writeFile(wb, `interacoes${suffix}_${today}.xlsx`);
}
