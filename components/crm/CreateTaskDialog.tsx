"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TASK_PRIORITY_LABELS } from "@/lib/data/crm-tasks-dummy";
import type { CrmTask } from "@/lib/data/crm-tasks-dummy";
import type { TenantUser } from "@/lib/types/crm";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  showCustomerSelect?: boolean;
  onSave: (task: Pick<CrmTask, "title" | "description" | "priority" | "dueDate" | "assignedTo" | "assignedToId"> & { customerId?: string }) => void;
}

const priorityOptions = Object.entries(TASK_PRIORITY_LABELS) as [CrmTask["priority"], string][];

export function CreateTaskDialog({
  open,
  onOpenChange,
  customerName,
  showCustomerSelect,
  onSave,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<CrmTask["priority"]>("MEDIA");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [customersList, setCustomersList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetch("/api/users")
        .then((res) => res.json())
        .then((data) => setUsers(Array.isArray(data) ? data : []))
        .catch(() => setUsers([]));

      if (showCustomerSelect) {
        fetch("/api/crm/customers")
          .then((res) => res.json())
          .then((data) =>
            setCustomersList(
              Array.isArray(data) ? data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })) : []
            )
          )
          .catch(() => setCustomersList([]));
      }
    }
  }, [open, showCustomerSelect]);

  const handleSave = () => {
    if (!title.trim()) return;
    if (showCustomerSelect && !customerId) return;
    const user = users.find((u) => u.id === assignedToId);
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      assignedTo: user?.name,
      assignedToId: user?.id,
      ...(showCustomerSelect && customerId ? { customerId } : {}),
    });
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("MEDIA");
    setDueDate("");
    setAssignedToId("");
    setCustomerId("");
  };

  const handleClose = (value: boolean) => {
    if (!value) resetForm();
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
          <DialogDescription>
            Criar tarefa para {customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {showCustomerSelect && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Cliente</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
              >
                <option value="">Selecione o cliente...</option>
                {customersList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Ligar para cobrar Royalties"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes da tarefa (opcional)"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CrmTask["priority"])}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
              >
                {priorityOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Vencimento</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Responsável</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
            >
              <option value="">Selecione...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => handleClose(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || (showCustomerSelect && !customerId)}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Criar Tarefa
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
