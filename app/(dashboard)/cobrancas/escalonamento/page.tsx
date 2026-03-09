"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getFranqueadoraHeaders } from "@/lib/fetch-with-tenant";
import { useFranqueadora } from "@/components/providers/FranqueadoraProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/use-toast";
import { format, differenceInDays } from "date-fns";
import {
  ShieldAlert,
  FileText,
  Scale,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EscalationTask {
  id: string;
  chargeId: string;
  type: "NEGATIVACAO" | "PROTESTO" | "JURIDICO";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  description: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  charge: {
    id: string;
    description: string;
    amountCents: number;
    dueDate: string;
    customer: {
      id: string;
      name: string;
    };
  };
}

// ─── Metadata ────────────────────────────────────────────────────────────────

const ESCALATION_META = {
  NEGATIVACAO: {
    label: "Negativação",
    icon: ShieldAlert,
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
  },
  PROTESTO: {
    label: "Protesto",
    icon: FileText,
    bgColor: "bg-gray-200",
    textColor: "text-gray-800",
  },
  JURIDICO: {
    label: "Jurídico",
    icon: Scale,
    bgColor: "bg-purple-100",
    textColor: "text-purple-800",
  },
} as const;

const STATUS_META = {
  PENDING: {
    label: "Pendente",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
  },
  IN_PROGRESS: {
    label: "Em andamento",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
  },
  COMPLETED: {
    label: "Concluído",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
  },
  CANCELLED: {
    label: "Cancelado",
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EscalonamentoPage() {
  const { activeFranqueadoraId } = useFranqueadora();

  const [tasks, setTasks] = useState<EscalationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ─── Fetch ───────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);

    const qs = params.toString();
    const url = `/api/escalation-tasks${qs ? `?${qs}` : ""}`;

    fetch(url, { headers: getFranqueadoraHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
        else setTasks([]);
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [activeFranqueadoraId, typeFilter, statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  async function updateTaskStatus(
    taskId: string,
    newStatus: "COMPLETED" | "CANCELLED"
  ) {
    setUpdatingIds((prev) => new Set(prev).add(taskId));

    try {
      const res = await fetch(`/api/escalation-tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getFranqueadoraHeaders(),
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Falha ao atualizar");

      toast({
        title:
          newStatus === "COMPLETED"
            ? "Tarefa concluída"
            : "Tarefa cancelada",
        description:
          newStatus === "COMPLETED"
            ? "A ação de escalonamento foi marcada como concluída."
            : "A ação de escalonamento foi cancelada.",
      });

      fetchTasks();
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a tarefa. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }

  // ─── Derived ─────────────────────────────────────────────────────────────

  const hasActiveFilters = typeFilter !== "all" || statusFilter !== "all";

  function clearFilters() {
    setTypeFilter("all");
    setStatusFilter("all");
  }

  const now = useMemo(() => new Date(), []);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <PageHeader title="Escalonamento" />
        <p className="text-sm text-gray-500 mt-1">
          Gerencie ações de negativação, protesto e encaminhamento jurídico
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <FilterPillGroup
          options={[
            { key: "all", label: "Todos" },
            { key: "NEGATIVACAO", label: "Negativação" },
            { key: "PROTESTO", label: "Protesto" },
            { key: "JURIDICO", label: "Jurídico" },
          ]}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        <div className="h-5 w-px bg-gray-200" />
        <FilterPillGroup
          options={[
            { key: "all", label: "Todos" },
            { key: "PENDING", label: "Pendentes" },
            { key: "IN_PROGRESS", label: "Em andamento" },
            { key: "COMPLETED", label: "Concluídos" },
            { key: "CANCELLED", label: "Cancelados" },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : tasks.length === 0 ? (
        <FilterEmptyState
          message={
            hasActiveFilters
              ? "Nenhuma tarefa de escalonamento encontrada para os filtros selecionados."
              : "Nenhuma tarefa de escalonamento encontrada."
          }
          suggestion={
            hasActiveFilters
              ? "Tente ajustar os filtros para encontrar outras tarefas."
              : "Tarefas de escalonamento serão criadas automaticamente pela régua de cobrança."
          }
          icon={<AlertTriangle className="h-6 w-6 text-gray-400" />}
          onClear={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map((task) => {
            const meta = ESCALATION_META[task.type];
            const statusMeta = STATUS_META[task.status];
            const TypeIcon = meta.icon;
            const daysOverdue = differenceInDays(
              now,
              new Date(task.charge.dueDate)
            );
            const isUpdating = updatingIds.has(task.id);
            const canAct =
              task.status === "PENDING" || task.status === "IN_PROGRESS";

            return (
              <div
                key={task.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow"
              >
                {/* Top: type badge + status badge */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full",
                      meta.bgColor,
                      meta.textColor
                    )}
                  >
                    <TypeIcon className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                  <span
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-full",
                      statusMeta.bgColor,
                      statusMeta.textColor
                    )}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                {/* Customer name */}
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {task.charge.customer.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {task.charge.description}
                  </p>
                </div>

                {/* Amount + Overdue */}
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(task.charge.amountCents)}
                  </span>
                  {daysOverdue > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                      <Clock className="h-3.5 w-3.5" />
                      {daysOverdue} {daysOverdue === 1 ? "dia" : "dias"} em
                      atraso
                    </span>
                  )}
                </div>

                {/* Created date */}
                <p className="text-xs text-gray-400">
                  Criado em {format(new Date(task.createdAt), "dd/MM/yyyy")}
                </p>

                {/* Resolved info (for completed tasks) */}
                {task.status === "COMPLETED" && task.resolvedAt && (
                  <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      Concluído em{" "}
                      {format(new Date(task.resolvedAt), "dd/MM/yyyy")}
                      {task.resolvedBy && ` por ${task.resolvedBy}`}
                    </span>
                  </div>
                )}

                {task.status === "CANCELLED" && task.resolvedAt && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      Cancelado em{" "}
                      {format(new Date(task.resolvedAt), "dd/MM/yyyy")}
                    </span>
                  </div>
                )}

                {/* Action buttons */}
                {canAct && (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <button
                      disabled={isUpdating}
                      onClick={() => updateTaskStatus(task.id, "COMPLETED")}
                      className={cn(
                        "flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors",
                        "bg-primary text-white hover:bg-primary-hover",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      Executar
                    </button>
                    <button
                      disabled={isUpdating}
                      onClick={() => updateTaskStatus(task.id, "CANCELLED")}
                      className={cn(
                        "inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors",
                        "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
