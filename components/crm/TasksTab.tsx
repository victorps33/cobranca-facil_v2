"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { Plus, Check, Calendar, User, Trash2 } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/crm/ConfirmDeleteDialog";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/crm-constants";
import type { CrmTask } from "@/lib/types/crm";

const fmtDate = (dateStr: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr));

interface TasksTabProps {
  tasks: CrmTask[];
  onAdd: () => void;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  hideAddButton?: boolean;
}

export function TasksTab({ tasks, onAdd, onComplete, onDelete, hideAddButton }: TasksTabProps) {
  const hoje = new Date();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPillGroup
          options={[
            { key: "all", label: "Todas", count: tasks.length },
            { key: "PENDENTE", label: "Pendente", count: tasks.filter((t) => t.status === "PENDENTE").length },
            { key: "EM_ANDAMENTO", label: "Em Andamento", count: tasks.filter((t) => t.status === "EM_ANDAMENTO").length },
            { key: "CONCLUIDA", label: "Concluída", count: tasks.filter((t) => t.status === "CONCLUIDA").length },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        {!hideAddButton && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-gray-400">
            {statusFilter === "all"
              ? "Nenhuma tarefa registrada."
              : "Nenhuma tarefa com este status."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const isOverdue =
              task.dueDate &&
              new Date(task.dueDate) < hoje &&
              (task.status === "PENDENTE" || task.status === "EM_ANDAMENTO");
            const canComplete =
              task.status === "PENDENTE" || task.status === "EM_ANDAMENTO";

            return (
              <div
                key={task.id}
                className={cn(
                  "bg-white rounded-xl border p-4",
                  isOverdue ? "border-red-200" : "border-gray-100"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        {task.title}
                      </h4>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          TASK_PRIORITY_COLORS[task.priority]
                        )}
                      >
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          TASK_STATUS_COLORS[task.status]
                        )}
                      >
                        {TASK_STATUS_LABELS[task.status]}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      {task.assignedTo && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {task.assignedTo}
                        </span>
                      )}
                      {task.dueDate && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            isOverdue && "text-red-500 font-medium"
                          )}
                        >
                          <Calendar className="h-3 w-3" />
                          {fmtDate(task.dueDate)}
                          {isOverdue && " (atrasada)"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canComplete && onComplete && (
                      <button
                        onClick={() => onComplete(task.id)}
                        className="flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                        title="Marcar como concluída"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => setDeleteTarget(task.id)}
                        className="flex items-center justify-center h-8 w-8 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Excluir tarefa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onDelete && (
        <ConfirmDeleteDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title="Excluir tarefa"
          description="Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita."
          onConfirm={() => {
            if (deleteTarget) {
              onDelete(deleteTarget);
              setDeleteTarget(null);
            }
          }}
        />
      )}
    </div>
  );
}
