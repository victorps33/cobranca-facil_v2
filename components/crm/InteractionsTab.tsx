"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { Mail, MessageCircle, Phone, StickyNote, Smartphone, Plus, Bot, Trash2, Download } from "lucide-react";
import { exportInteractionsToXlsx } from "@/lib/crm-export";
import { ConfirmDeleteDialog } from "@/components/crm/ConfirmDeleteDialog";
import {
  INTERACTION_TYPE_LABELS,
  INTERACTION_TYPE_COLORS,
  DIRECTION_LABELS,
} from "@/lib/data/crm-interactions-dummy";
import type { CrmInteraction } from "@/lib/data/crm-interactions-dummy";

const typeIcons: Record<CrmInteraction["type"], typeof Mail> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: Smartphone,
  TELEFONE: Phone,
  NOTA_INTERNA: StickyNote,
};

const fmtDateTime = (dateStr: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));

interface InteractionsTabProps {
  interactions: CrmInteraction[];
  onAdd: () => void;
  onDelete?: (interactionId: string) => void;
  hideAddButton?: boolean;
  customerName?: string;
}

export function InteractionsTab({ interactions, onAdd, onDelete, hideAddButton, customerName }: InteractionsTabProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return interactions;
    return interactions.filter((i) => i.type === typeFilter);
  }, [interactions, typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPillGroup
          options={[
            { key: "all", label: "Todos", count: interactions.length },
            ...Object.entries(INTERACTION_TYPE_LABELS).map(([key, label]) => ({
              key,
              label,
              count: interactions.filter((i) => i.type === key).length,
            })).filter((o) => o.count > 0),
          ]}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        <div className="flex items-center gap-2">
          {interactions.length > 0 && (
            <button
              onClick={() => exportInteractionsToXlsx(filtered, customerName)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar
            </button>
          )}
          {!hideAddButton && (
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors"
            >
              <Plus className="h-4 w-4" />
              Registrar Interação
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-gray-400">
            {typeFilter === "all"
              ? "Nenhuma interação registrada."
              : "Nenhuma interação deste tipo."}
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-4">
            {filtered.map((interaction) => {
              const Icon = typeIcons[interaction.type] ?? StickyNote;
              const typeColor = INTERACTION_TYPE_COLORS[interaction.type];

              return (
                <div key={interaction.id} className="relative flex gap-4 pl-2">
                  {/* Icon */}
                  <div
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white",
                      typeColor
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-white rounded-xl border border-gray-100 p-4 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          typeColor
                        )}
                      >
                        {INTERACTION_TYPE_LABELS[interaction.type]}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">
                        {DIRECTION_LABELS[interaction.direction]}
                      </span>
                      {interaction.isAutomatic && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">
                          <Bot className="h-3 w-3" />
                          Automático
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {interaction.content}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{interaction.createdBy}</span>
                        <span>·</span>
                        <span>{fmtDateTime(interaction.createdAt)}</span>
                      </div>
                      {onDelete && (
                        <button
                          onClick={() => setDeleteTarget(interaction.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1 -mr-1"
                          title="Excluir interação"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {onDelete && (
        <ConfirmDeleteDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title="Excluir interação"
          description="Tem certeza que deseja excluir esta interação? Esta ação não pode ser desfeita."
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
