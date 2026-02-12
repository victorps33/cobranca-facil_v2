"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  Mail,
  MessageCircle,
  Phone,
  Smartphone,
  StickyNote,
  Receipt,
  ListTodo,
  CheckCircle2,
  Bot,
} from "lucide-react";
import type { CrmInteraction, CrmTask } from "@/lib/types/crm";
import type { Cobranca } from "@/lib/types";
import {
  INTERACTION_TYPE_LABELS,
  DIRECTION_LABELS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/crm-constants";

// ── Types ──

type TimelineEntry =
  | { kind: "interaction"; date: string; data: CrmInteraction }
  | { kind: "task"; date: string; data: CrmTask }
  | { kind: "charge"; date: string; data: Cobranca };

// ── Helpers ──

const fmtDateTime = (dateStr: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));

const fmtDate = (dateStr: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr));

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

const interactionIcons: Record<CrmInteraction["type"], typeof Mail> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: Smartphone,
  TELEFONE: Phone,
  NOTA_INTERNA: StickyNote,
};

const kindStyles = {
  interaction: { bg: "bg-blue-50", text: "text-blue-600", line: "bg-blue-200" },
  task: { bg: "bg-violet-50", text: "text-violet-600", line: "bg-violet-200" },
  charge: { bg: "bg-amber-50", text: "text-amber-600", line: "bg-amber-200" },
};

const chargeStatusColors: Record<string, string> = {
  Aberta: "text-blue-600",
  Vencida: "text-red-600",
  Paga: "text-emerald-600",
  Cancelada: "text-gray-400",
};

// ── Component ──

interface TimelineTabProps {
  interactions: CrmInteraction[];
  tasks: CrmTask[];
  cobrancas: Cobranca[];
}

export function TimelineTab({ interactions, tasks, cobrancas }: TimelineTabProps) {
  const entries = useMemo(() => {
    const all: TimelineEntry[] = [
      ...interactions.map(
        (i): TimelineEntry => ({ kind: "interaction", date: i.createdAt, data: i })
      ),
      ...tasks.map(
        (t): TimelineEntry => ({ kind: "task", date: t.createdAt, data: t })
      ),
      ...cobrancas.map(
        (c): TimelineEntry => ({ kind: "charge", date: c.dataEmissao, data: c })
      ),
    ];
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }, [interactions, tasks, cobrancas]);

  if (entries.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-gray-400">Nenhum evento registrado.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

      <div className="space-y-4">
        {entries.map((entry, idx) => {
          const style = kindStyles[entry.kind];

          return (
            <div key={`${entry.kind}-${idx}`} className="relative flex gap-4 pl-2">
              {/* Icon */}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white",
                  style.bg,
                  style.text
                )}
              >
                <TimelineIcon entry={entry} />
              </div>

              {/* Content */}
              <div className="flex-1 bg-white rounded-xl border border-gray-100 p-4 min-w-0">
                <TimelineContent entry={entry} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-components ──

function TimelineIcon({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "interaction") {
    const Icon = interactionIcons[entry.data.type] ?? StickyNote;
    return <Icon className="h-3.5 w-3.5" />;
  }
  if (entry.kind === "task") {
    return entry.data.status === "CONCLUIDA"
      ? <CheckCircle2 className="h-3.5 w-3.5" />
      : <ListTodo className="h-3.5 w-3.5" />;
  }
  return <Receipt className="h-3.5 w-3.5" />;
}

function TimelineContent({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "interaction") {
    const i = entry.data;
    return (
      <>
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="text-xs font-medium text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">
            {INTERACTION_TYPE_LABELS[i.type]}
          </span>
          <span className="text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">
            {DIRECTION_LABELS[i.direction]}
          </span>
          {i.isAutomatic && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">
              <Bot className="h-3 w-3" />
              Automático
            </span>
          )}
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
          {i.content}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <span>{i.createdBy}</span>
          <span>·</span>
          <span>{fmtDateTime(i.createdAt)}</span>
        </div>
      </>
    );
  }

  if (entry.kind === "task") {
    const t = entry.data;
    return (
      <>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-medium text-violet-700 bg-violet-50 rounded-full px-2 py-0.5">
            Tarefa
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              TASK_PRIORITY_COLORS[t.priority]
            )}
          >
            {TASK_PRIORITY_LABELS[t.priority]}
          </span>
        </div>
        <p className="text-sm font-medium text-gray-900">{t.title}</p>
        {t.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <span>{TASK_STATUS_LABELS[t.status]}</span>
          {t.assignedTo && (
            <>
              <span>·</span>
              <span>{t.assignedTo}</span>
            </>
          )}
          {t.dueDate && (
            <>
              <span>·</span>
              <span>Vence {fmtDate(t.dueDate)}</span>
            </>
          )}
          <span>·</span>
          <span>{fmtDateTime(t.createdAt)}</span>
        </div>
      </>
    );
  }

  // charge
  const c = entry.data;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
          Cobrança
        </span>
        <span className={cn("text-xs font-medium", chargeStatusColors[c.status] ?? "text-gray-500")}>
          {c.status}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-900">{c.descricao}</p>
      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
        <span className="tabular-nums">{fmtBRL(c.valorOriginal)}</span>
        <span>·</span>
        <span>{c.categoria}</span>
        <span>·</span>
        <span>Vence {fmtDate(c.dataVencimento)}</span>
        {c.dataPagamento && (
          <>
            <span>·</span>
            <span className="text-emerald-600">Pago {fmtDate(c.dataPagamento)}</span>
          </>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-1">
        Emitida em {fmtDateTime(c.dataEmissao)}
      </div>
    </>
  );
}
