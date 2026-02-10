"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { StatCard } from "@/components/layout/StatCard";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { CreateTaskDialog } from "@/components/crm/CreateTaskDialog";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/use-toast";
import { exportTasksToXlsx } from "@/lib/crm-export";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/data/crm-tasks-dummy";
import type { CrmTask } from "@/lib/data/crm-tasks-dummy";
import type { CrmTask as ApiCrmTask } from "@/lib/types/crm";
import type { UserRole } from "@prisma/client";
import {
  Search,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  User,
  ChevronDown,
  Download,
  Loader2,
} from "lucide-react";

const fmtDate = (dateStr: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr));

const statusTransitions: Record<string, CrmTask["status"][]> = {
  PENDENTE: ["EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"],
  EM_ANDAMENTO: ["PENDENTE", "CONCLUIDA", "CANCELADA"],
  CONCLUIDA: ["PENDENTE", "EM_ANDAMENTO"],
  CANCELADA: ["PENDENTE"],
};

function mapApiTask(t: ApiCrmTask): CrmTask {
  return {
    id: t.id,
    customerId: t.customerId,
    customerName: t.customerName,
    chargeId: t.chargeId ?? undefined,
    title: t.title,
    description: t.description ?? undefined,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ?? undefined,
    assignedTo: t.assignedTo ?? undefined,
    assignedToId: t.assignedToId ?? undefined,
    completedAt: t.completedAt ?? undefined,
    createdBy: t.createdBy,
    createdById: t.createdById,
    createdAt: t.createdAt,
  };
}

function getTasksStats(tasks: CrmTask[]) {
  const hoje = new Date();
  const pendentes = tasks.filter((t) => t.status === "PENDENTE").length;
  const emAndamento = tasks.filter((t) => t.status === "EM_ANDAMENTO").length;
  const concluidas = tasks.filter((t) => t.status === "CONCLUIDA").length;
  const atrasadas = tasks.filter(
    (t) =>
      t.dueDate &&
      new Date(t.dueDate) < hoje &&
      (t.status === "PENDENTE" || t.status === "EM_ANDAMENTO")
  ).length;

  return { pendentes, emAndamento, concluidas, atrasadas };
}

export default function TarefasPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const isReadOnly = userRole === "VISUALIZADOR";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // API data
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crm/tasks")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: ApiCrmTask[]) => setTasks(data.map(mapApiTask)))
      .catch(() => {
        setTasks([]);
        toast({ title: "Erro", description: "Falha ao carregar tarefas.", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, []);

  // Dropdown state for inline status change
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenStatusMenuId(null);
      }
    }
    if (openStatusMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openStatusMenuId]);

  const filtered = useMemo(() => {
    let list = [...tasks];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          (t.assignedTo && t.assignedTo.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      list = list.filter((t) => t.priority === priorityFilter);
    }
    if (showMyTasks && session?.user?.id) {
      list = list.filter((t) => t.assignedToId === session.user.id);
    }

    const hoje = new Date();
    list.sort((a, b) => {
      const aOverdue = a.dueDate && new Date(a.dueDate) < hoje && (a.status === "PENDENTE" || a.status === "EM_ANDAMENTO") ? 0 : 1;
      const bOverdue = b.dueDate && new Date(b.dueDate) < hoje && (b.status === "PENDENTE" || b.status === "EM_ANDAMENTO") ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return list;
  }, [search, statusFilter, priorityFilter, showMyTasks, session?.user?.id, tasks]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safeCurrentPage = Math.min(page, Math.max(1, totalPages));
  const paginatedTasks = filtered.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  const stats = getTasksStats(tasks);
  const hasActiveFilters = search !== "" || statusFilter !== "all" || priorityFilter !== "all" || showMyTasks;
  const hoje = new Date();

  const handleAddTask = async (
    data: Pick<CrmTask, "title" | "description" | "priority" | "dueDate" | "assignedTo" | "assignedToId"> & { customerId?: string }
  ) => {
    try {
      const res = await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: data.customerId || null,
          title: data.title,
          description: data.description || null,
          priority: data.priority,
          dueDate: data.dueDate || null,
          assignedToId: data.assignedToId || null,
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      const newTask: CrmTask = {
        id: created.id,
        customerId: created.customerId,
        customerName: created.customer?.name ?? "Geral",
        status: created.status,
        priority: created.priority,
        title: created.title,
        description: created.description ?? undefined,
        dueDate: created.dueDate ?? undefined,
        assignedTo: created.assignedTo?.name ?? undefined,
        assignedToId: created.assignedToId ?? undefined,
        completedAt: created.completedAt ?? undefined,
        createdBy: created.createdBy?.name ?? session?.user?.name ?? "Usuário",
        createdById: created.createdById,
        createdAt: created.createdAt,
      };
      setTasks((prev) => [newTask, ...prev]);
      toast({ title: "Tarefa criada", description: `"${data.title}" foi adicionada.` });
    } catch {
      toast({ title: "Erro", description: "Falha ao criar tarefa.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: CrmTask["status"]) => {
    setOpenStatusMenuId(null);
    try {
      const res = await fetch(`/api/crm/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: newStatus,
                ...(newStatus === "CONCLUIDA" && { completedAt: new Date().toISOString() }),
              }
            : t
        )
      );
      toast({
        title: "Status atualizado",
        description: `Tarefa movida para "${TASK_STATUS_LABELS[newStatus]}".`,
      });
    } catch {
      toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Carregando tarefas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarefas"
        subtitle={`${tasks.length} tarefas no total`}
        secondaryActions={[
          {
            label: "Exportar",
            icon: <Download className="h-4 w-4" />,
            onClick: () => exportTasksToXlsx(filtered),
          },
        ]}
        primaryAction={
          isReadOnly
            ? undefined
            : {
                label: "Nova Tarefa",
                onClick: () => setTaskDialogOpen(true),
              }
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Clock className="h-4 w-4 text-gray-400" />}
          label="Pendentes"
          value={String(stats.pendentes)}
        />
        <StatCard
          icon={<Play className="h-4 w-4 text-gray-400" />}
          label="Em Andamento"
          value={String(stats.emAndamento)}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-gray-400" />}
          label="Concluídas"
          value={String(stats.concluidas)}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-gray-400" />}
          label="Atrasadas"
          value={String(stats.atrasadas)}
          danger={stats.atrasadas > 0}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por tarefa, cliente ou responsável…"
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus-visible:ring-2 focus-visible:ring-secondary/30 focus-visible:border-secondary transition-colors"
          />
        </div>
        <FilterPillGroup
          options={[
            { key: "all", label: "Todos" },
            { key: "PENDENTE", label: "Pendente" },
            { key: "EM_ANDAMENTO", label: "Em Andamento" },
            { key: "CONCLUIDA", label: "Concluída" },
            { key: "CANCELADA", label: "Cancelada" },
          ]}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
        />
        <FilterPillGroup
          options={[
            { key: "all", label: "Todas" },
            { key: "CRITICA", label: "Crítica" },
            { key: "ALTA", label: "Alta" },
            { key: "MEDIA", label: "Média" },
            { key: "BAIXA", label: "Baixa" },
          ]}
          value={priorityFilter}
          onChange={(v) => { setPriorityFilter(v); setPage(1); }}
        />
        <button
          onClick={() => { setShowMyTasks((v) => !v); setPage(1); }}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
            showMyTasks
              ? "bg-primary text-white border-primary"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          )}
        >
          <User className="h-3 w-3" />
          Minhas Tarefas
        </button>
      </div>

      {/* Table or Empty */}
      {filtered.length === 0 ? (
        <FilterEmptyState
          message="Nenhuma tarefa encontrada para os filtros selecionados."
          suggestion="Tente ajustar os filtros ou criar uma nova tarefa."
          onClear={
            hasActiveFilters
              ? () => {
                  setSearch("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                  setShowMyTasks(false);
                }
              : undefined
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                    Tarefa
                  </th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                    Prioridade
                  </th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                    Responsável
                  </th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                    Vencimento
                  </th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedTasks.map((t) => {
                  const isOverdue =
                    t.dueDate &&
                    new Date(t.dueDate) < hoje &&
                    (t.status === "PENDENTE" || t.status === "EM_ANDAMENTO");
                  const transitions = statusTransitions[t.status] ?? [];

                  return (
                    <tr
                      key={t.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td
                        className="px-5 py-3 cursor-pointer"
                        onClick={() => t.customerId && router.push(`/crm/${t.customerId}`)}
                      >
                        <p className="font-medium text-gray-900">{t.title}</p>
                        {t.description && (
                          <p className="text-xs text-gray-400 truncate max-w-[250px]">
                            {t.description}
                          </p>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-gray-600 cursor-pointer"
                        onClick={() => t.customerId && router.push(`/crm/${t.customerId}`)}
                      >
                        {t.customerName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                            TASK_PRIORITY_COLORS[t.priority]
                          )}
                        >
                          {TASK_PRIORITY_LABELS[t.priority]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {t.assignedTo ? (
                          <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                            <User className="h-3 w-3 text-gray-400" />
                            {t.assignedTo}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.dueDate ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-sm",
                              isOverdue
                                ? "text-red-600 font-medium"
                                : "text-gray-600"
                            )}
                          >
                            <Calendar className="h-3 w-3" />
                            {fmtDate(t.dueDate)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!isReadOnly && transitions.length > 0 ? (
                          <div
                            className="relative"
                            ref={openStatusMenuId === t.id ? menuRef : undefined}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenStatusMenuId(openStatusMenuId === t.id ? null : t.id);
                              }}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                                TASK_STATUS_COLORS[t.status]
                              )}
                            >
                              {TASK_STATUS_LABELS[t.status]}
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            {openStatusMenuId === t.id && (
                              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                                {transitions.map((status) => (
                                  <button
                                    key={status}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(t.id, status);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <span
                                      className={cn(
                                        "inline-block h-2 w-2 rounded-full",
                                        TASK_STATUS_COLORS[status].split(" ")[0]
                                      )}
                                    />
                                    {TASK_STATUS_LABELS[status]}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              TASK_STATUS_COLORS[t.status]
                            )}
                          >
                            {TASK_STATUS_LABELS[t.status]}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Create Task Dialog */}
      {!isReadOnly && (
        <CreateTaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          customerName="Geral"
          showCustomerSelect
          onSave={handleAddTask}
        />
      )}
    </div>
  );
}
