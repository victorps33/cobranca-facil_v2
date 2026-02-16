"use client";

import { useState, useMemo, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { MetricCard } from "@/components/ui/metric-card";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { CreateTaskDialog } from "@/components/crm/CreateTaskDialog";
import { Pagination } from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/use-toast";
import { exportTasksToXlsx } from "@/lib/crm-export";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/crm-constants";
import type { CrmTask } from "@/lib/types/crm";
import type { UserRole } from "@prisma/client";
import { Skeleton, KpiSkeleton, TableSkeleton } from "@/components/ui/skeleton";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const fmtDate = (dateStr: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr));

const statusTransitions: Record<string, CrmTask["status"][]> = {
  PENDENTE: ["EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"],
  EM_ANDAMENTO: ["PENDENTE", "CONCLUIDA", "CANCELADA"],
  CONCLUIDA: ["PENDENTE", "EM_ANDAMENTO"],
  CANCELADA: ["PENDENTE"],
};

const PRIORITY_ORDER: Record<string, number> = {
  CRITICA: 0,
  ALTA: 1,
  MEDIA: 2,
  BAIXA: 3,
};

function mapApiTask(t: CrmTask): CrmTask {
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

type SortKey = "dueDate" | "priority" | null;
type SortDir = "asc" | "desc";

export interface CrmTarefasTabActions {
  openNewTask: () => void;
  exportTasks: () => void;
}

interface CrmTarefasTabProps {
  actionsRef?: React.MutableRefObject<CrmTarefasTabActions | null>;
}

export function CrmTarefasTab({ actionsRef }: CrmTarefasTabProps = {}) {
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
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const PAGE_SIZE = 10;

  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crm/tasks")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: CrmTask[]) => setTasks(data.map(mapApiTask)))
      .catch(() => {
        setTasks([]);
        toast({
          title: "Erro",
          description: "Falha ao carregar tarefas.",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column)
      return <ArrowUpDown className="h-3 w-3 text-gray-300" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-gray-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-gray-600" />
    );
  };

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

    if (sortKey === "dueDate") {
      list.sort((a, b) => {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return sortDir === "asc" ? aDate - bDate : bDate - aDate;
      });
    } else if (sortKey === "priority") {
      list.sort((a, b) => {
        const aOrd = PRIORITY_ORDER[a.priority] ?? 99;
        const bOrd = PRIORITY_ORDER[b.priority] ?? 99;
        return sortDir === "asc" ? aOrd - bOrd : bOrd - aOrd;
      });
    } else {
      const hoje = new Date();
      list.sort((a, b) => {
        const aOverdue =
          a.dueDate &&
          new Date(a.dueDate) < hoje &&
          (a.status === "PENDENTE" || a.status === "EM_ANDAMENTO")
            ? 0
            : 1;
        const bOverdue =
          b.dueDate &&
          new Date(b.dueDate) < hoje &&
          (b.status === "PENDENTE" || b.status === "EM_ANDAMENTO")
            ? 0
            : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        return b.createdAt.localeCompare(a.createdAt);
      });
    }

    return list;
  }, [
    search,
    statusFilter,
    priorityFilter,
    showMyTasks,
    session?.user?.id,
    tasks,
    sortKey,
    sortDir,
  ]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safeCurrentPage = Math.min(page, Math.max(1, totalPages));
  const paginatedTasks = filtered.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  const stats = getTasksStats(tasks);

  // Expose actions to parent (PageHeader buttons)
  useLayoutEffect(() => {
    if (actionsRef) {
      actionsRef.current = {
        openNewTask: () => setTaskDialogOpen(true),
        exportTasks: () => exportTasksToXlsx(filtered),
      };
    }
    return () => { if (actionsRef) actionsRef.current = null; };
  });

  const hasActiveFilters =
    search !== "" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    showMyTasks;
  const hoje = new Date();

  const handleAddTask = async (
    data: Pick<
      CrmTask,
      "title" | "description" | "priority" | "dueDate" | "assignedTo" | "assignedToId"
    > & { customerId?: string }
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
        customerName: created.customerName ?? "Geral",
        status: created.status,
        priority: created.priority,
        title: created.title,
        description: created.description ?? undefined,
        dueDate: created.dueDate ?? undefined,
        assignedTo: created.assignedTo ?? undefined,
        assignedToId: created.assignedToId ?? undefined,
        completedAt: created.completedAt ?? undefined,
        createdBy:
          created.createdBy ?? session?.user?.name ?? "Usuario",
        createdById: created.createdById,
        createdAt: created.createdAt,
      };
      setTasks((prev) => [newTask, ...prev]);
      toast({
        title: "Tarefa criada",
        description: `"${data.title}" foi adicionada.`,
      });
    } catch {
      toast({
        title: "Erro",
        description: "Falha ao criar tarefa.",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (
    taskId: string,
    newStatus: CrmTask["status"]
  ) => {
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
                ...(newStatus === "CONCLUIDA" && {
                  completedAt: new Date().toISOString(),
                }),
              }
            : t
        )
      );
      toast({
        title: "Status atualizado",
        description: `Tarefa movida para "${TASK_STATUS_LABELS[newStatus]}".`,
      });
    } catch {
      toast({
        title: "Erro",
        description: "Falha ao atualizar status.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <KpiSkeleton count={4} />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-48 rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <TableSkeleton rows={8} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Clock className="h-4 w-4" />}
          title="Pendentes"
          value={String(stats.pendentes)}
          subtitle="aguardando início"
          className="animate-in stagger-1"
        />
        <MetricCard
          icon={<Play className="h-4 w-4" />}
          title="Em Andamento"
          value={String(stats.emAndamento)}
          subtitle="em execução"
          className="animate-in stagger-2"
        />
        <MetricCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          title="Concluídas"
          value={String(stats.concluidas)}
          subtitle="finalizadas"
          className="animate-in stagger-3"
        />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Atrasadas"
          value={String(stats.atrasadas)}
          subtitle="prazo expirado"
          variant={stats.atrasadas > 0 ? "danger" : "default"}
          className="animate-in stagger-4"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por tarefa, cliente ou responsavel..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus-visible:ring-2 focus-visible:ring-secondary/30 focus-visible:border-secondary transition-colors"
          />
        </div>
        <FilterPillGroup
          options={[
            { key: "all", label: "Todos" },
            { key: "PENDENTE", label: "Pendente" },
            { key: "EM_ANDAMENTO", label: "Em Andamento" },
            { key: "CONCLUIDA", label: "Concluida" },
            { key: "CANCELADA", label: "Cancelada" },
          ]}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        />
        <FilterPillGroup
          options={[
            { key: "all", label: "Todas" },
            { key: "CRITICA", label: "Critica" },
            { key: "ALTA", label: "Alta" },
            { key: "MEDIA", label: "Media" },
            { key: "BAIXA", label: "Baixa" },
          ]}
          value={priorityFilter}
          onChange={(v) => {
            setPriorityFilter(v);
            setPage(1);
          }}
        />
        <button
          onClick={() => {
            setShowMyTasks((v) => !v);
            setPage(1);
          }}
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
                  <th
                    className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-600 transition-colors"
                    onClick={() => handleSort("priority")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Prioridade <SortIcon column="priority" />
                    </span>
                  </th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                    Responsavel
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-600 transition-colors"
                    onClick={() => handleSort("dueDate")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Vencimento <SortIcon column="dueDate" />
                    </span>
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
                        onClick={() =>
                          t.customerId && router.push(`/crm/${t.customerId}`)
                        }
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
                        onClick={() =>
                          t.customerId && router.push(`/crm/${t.customerId}`)
                        }
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
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-100 text-[10px] font-medium text-gray-500">
                              {t.assignedTo
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </span>
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                                  TASK_STATUS_COLORS[t.status]
                                )}
                              >
                                {TASK_STATUS_LABELS[t.status]}
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-[160px] rounded-xl"
                            >
                              {transitions.map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={() =>
                                    handleStatusChange(t.id, status)
                                  }
                                  className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer rounded-lg"
                                >
                                  <span
                                    className={cn(
                                      "inline-block h-2 w-2 rounded-full",
                                      TASK_STATUS_COLORS[status].split(" ")[0]
                                    )}
                                  />
                                  {TASK_STATUS_LABELS[status]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
