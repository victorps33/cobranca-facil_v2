"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { cn } from "@/lib/cn";
import {
  Bell,
  Mail,
  MessageSquare,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
} from "lucide-react";

interface ReguaStep {
  id: string;
  offset: string; // e.g. "D-5", "D0", "D+3"
  channel: "Email" | "SMS" | "WhatsApp" | "Telefone";
  description: string;
}

interface Regua {
  id: string;
  name: string;
  description: string;
  active: boolean;
  steps: ReguaStep[];
}

const REGUAS_DATA: Regua[] = [
  {
    id: "R1",
    name: "Padrão",
    description: "Régua principal de cobrança para franqueados",
    active: true,
    steps: [
      { id: "s1", offset: "D-5", channel: "Email", description: "Lembrete de vencimento próximo" },
      { id: "s2", offset: "D-1", channel: "WhatsApp", description: "Aviso de vencimento amanhã" },
      { id: "s3", offset: "D0", channel: "Email", description: "Cobrança no dia do vencimento" },
      { id: "s4", offset: "D+3", channel: "SMS", description: "Notificação de atraso" },
      { id: "s5", offset: "D+7", channel: "Telefone", description: "Contato direto por telefone" },
    ],
  },
  {
    id: "R2",
    name: "VIP",
    description: "Régua suave para franqueados prioritários",
    active: false,
    steps: [
      { id: "s1", offset: "D-3", channel: "Email", description: "Lembrete gentil" },
      { id: "s2", offset: "D+5", channel: "WhatsApp", description: "Follow-up educado" },
    ],
  },
  {
    id: "R3",
    name: "Alto Risco",
    description: "Régua agressiva para inadimplentes recorrentes",
    active: true,
    steps: [
      { id: "s1", offset: "D-7", channel: "Email", description: "Alerta antecipado" },
      { id: "s2", offset: "D-1", channel: "SMS", description: "Urgência de pagamento" },
      { id: "s3", offset: "D0", channel: "WhatsApp", description: "Cobrança imediata" },
      { id: "s4", offset: "D+1", channel: "Telefone", description: "Ligação no dia seguinte" },
      { id: "s5", offset: "D+3", channel: "Email", description: "Aviso de protesto" },
      { id: "s6", offset: "D+7", channel: "Telefone", description: "Última tentativa antes de protesto" },
    ],
  },
];

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  Email: <Mail className="h-3.5 w-3.5" />,
  SMS: <MessageSquare className="h-3.5 w-3.5" />,
  WhatsApp: <MessageSquare className="h-3.5 w-3.5" />,
  Telefone: <Phone className="h-3.5 w-3.5" />,
};

export default function ReguasPage() {
  const [reguas, setReguas] = useState(REGUAS_DATA);
  const [expandedId, setExpandedId] = useState<string | null>("R1");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filteredReguas = activeFilter === "all"
    ? reguas
    : activeFilter === "active"
      ? reguas.filter((r) => r.active)
      : reguas.filter((r) => !r.active);

  function toggleActive(id: string) {
    setReguas((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réguas de Cobrança"
        subtitle="Configure fluxos automáticos de notificação"
        primaryAction={{ label: "Nova Régua", onClick: () => {} }}
      />

      {/* ── Filters ── */}
      <div className="flex items-center gap-1.5">
        {[
          { key: "all", label: "Todas" },
          { key: "active", label: "Ativas" },
          { key: "inactive", label: "Inativas" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              activeFilter === f.key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredReguas.length === 0 ? (
        <FilterEmptyState
          message={
            activeFilter !== "all"
              ? "Nenhuma régua encontrada para o filtro selecionado."
              : "Nenhuma régua cadastrada. Crie uma para automatizar cobranças."
          }
          icon={<Bell className="h-6 w-6 text-gray-400" />}
          onClear={activeFilter !== "all" ? () => setActiveFilter("all") : undefined}
        />
      ) : (
        <div className="space-y-4">
          {filteredReguas.map((regua) => {
            const isExpanded = expandedId === regua.id;
            return (
              <div
                key={regua.id}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : regua.id)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      regua.active ? "bg-emerald-50" : "bg-gray-100"
                    )}>
                      <Bell className={cn("h-5 w-5", regua.active ? "text-emerald-600" : "text-gray-400")} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{regua.name}</h3>
                        <span className={cn(
                          "px-2 py-0.5 text-xs font-medium rounded-full",
                          regua.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                        )}>
                          {regua.active ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{regua.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{regua.steps.length} etapas</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleActive(regua.id); }}
                      aria-label={regua.active ? `Desativar ${regua.name}` : `Ativar ${regua.name}`}
                      className="p-1"
                    >
                      {regua.active
                        ? <ToggleRight className="h-6 w-6 text-emerald-500" aria-hidden="true" />
                        : <ToggleLeft className="h-6 w-6 text-gray-300" aria-hidden="true" />
                      }
                    </button>
                    <ChevronRight className={cn("h-4 w-4 text-gray-400 transition-transform", isExpanded && "rotate-90")} aria-hidden="true" />
                  </div>
                </button>

                {/* Timeline (expanded) */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                    <div className="relative pl-8">
                      {/* Vertical line */}
                      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200" />
                      <div className="space-y-4">
                        {regua.steps.map((step, i) => {
                          const isNegative = step.offset.startsWith("D-");
                          const isZero = step.offset === "D0";
                          return (
                            <div key={step.id} className="relative flex items-start gap-4">
                              {/* Dot */}
                              <div className={cn(
                                "absolute -left-[1.125rem] mt-1.5 flex h-3 w-3 items-center justify-center rounded-full border-2 bg-white",
                                isZero
                                  ? "border-[#F85B00]"
                                  : isNegative
                                    ? "border-blue-400"
                                    : "border-amber-400"
                              )} />
                              {/* Content */}
                              <div className="flex-1 flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "text-xs font-mono font-bold",
                                      isZero ? "text-[#F85B00]" : isNegative ? "text-blue-600" : "text-amber-600"
                                    )}>
                                      {step.offset}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                                      {CHANNEL_ICONS[step.channel]}
                                      {step.channel}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-0.5">{step.description}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
