"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { StatCard } from "@/components/layout/StatCard";
import { cn } from "@/lib/cn";
import {
  Send,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  DollarSign,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

function getCurrentPeriodLabel(): string {
  const now = new Date();
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[now.getMonth()]}/${String(now.getFullYear()).slice(-2)}`;
}

const EMISSAO_DATA = [
  { id: "E001", franqueado: "Franquia Morumbi", valor: 57000, nf: true, status: "Emitida" as const },
  { id: "E002", franqueado: "Franquia Vila Mariana", valor: 47500, nf: true, status: "Emitida" as const },
  { id: "E003", franqueado: "Franquia Santo Amaro", valor: 40000, nf: false, status: "Pendente" as const },
  { id: "E004", franqueado: "Franquia Campo Belo", valor: 35000, nf: false, status: "Pendente" as const },
  { id: "E005", franqueado: "Franquia Itaim Bibi", valor: 65000, nf: true, status: "Emitida" as const },
  { id: "E006", franqueado: "Franquia Moema", valor: 27500, nf: false, status: "Erro" as const },
  { id: "E007", franqueado: "Franquia Brooklin", valor: 51250, nf: true, status: "Emitida" as const },
  { id: "E008", franqueado: "Franquia Saúde", valor: 23750, nf: false, status: "Pendente" as const },
];

const STATUS_COLORS: Record<string, string> = {
  Emitida: "bg-emerald-50 text-emerald-700",
  Pendente: "bg-amber-50 text-amber-700",
  Erro: "bg-red-50 text-red-700",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  Emitida: <CheckCircle2 className="h-3.5 w-3.5" />,
  Pendente: <Clock className="h-3.5 w-3.5" />,
  Erro: <AlertCircle className="h-3.5 w-3.5" />,
};

export default function EmissaoPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emitirNfGlobal, setEmitirNfGlobal] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [nfFilter, setNfFilter] = useState("all");

  const periodLabel = `Competência: ${getCurrentPeriodLabel()}`;

  const filtered = EMISSAO_DATA.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (nfFilter === "emitida" && !e.nf) return false;
    if (nfFilter === "pendente" && e.nf) return false;
    return true;
  });

  const hasActiveFilters = statusFilter !== "all" || nfFilter !== "all";

  const totalValor = EMISSAO_DATA.reduce((s, e) => s + e.valor, 0);
  const emitidas = EMISSAO_DATA.filter((e) => e.status === "Emitida").length;
  const pendentes = EMISSAO_DATA.filter((e) => e.status === "Pendente").length;
  const nfEmitidas = EMISSAO_DATA.filter((e) => e.nf).length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((e) => e.id)));
  }

  return (
    <div className="space-y-6">
      {/* ── Single Page Header ── */}
      <PageHeader
        title="Emissão"
        subtitle="Gere cobranças e notas fiscais para franqueados"
        period={periodLabel}
        primaryAction={{
          label: `Emitir ${selected.size > 0 ? `(${selected.size})` : ""}`,
          icon: <Send className="h-4 w-4" />,
          onClick: () => {},
        }}
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign className="h-4 w-4 text-gray-400" />} label="Total a Emitir" value={fmt(totalValor)} caption={periodLabel} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-gray-400" />} label="Emitidas" value={`${emitidas}/${EMISSAO_DATA.length}`} caption="cobranças" />
        <StatCard icon={<Clock className="h-4 w-4 text-gray-400" />} label="Pendentes" value={String(pendentes)} caption="aguardando emissão" />
        <StatCard icon={<FileText className="h-4 w-4 text-gray-400" />} label="NF Emitidas" value={`${nfEmitidas}/${EMISSAO_DATA.length}`} caption="notas fiscais" />
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {["all", "Emitida", "Pendente", "Erro"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                statusFilter === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {s === "all" ? "Todas" : s}
            </button>
          ))}
        </div>
        {/* NF pills */}
        <div className="flex items-center gap-1.5">
          {[
            { key: "all", label: "Todas NFs" },
            { key: "emitida", label: "NF Emitida" },
            { key: "pendente", label: "NF Pendente" },
          ].map((n) => (
            <button
              key={n.key}
              onClick={() => setNfFilter(n.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                nfFilter === n.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {n.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setEmitirNfGlobal(!emitirNfGlobal)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {emitirNfGlobal
              ? <ToggleRight className="h-4 w-4 text-[#F85B00]" />
              : <ToggleLeft className="h-4 w-4 text-gray-400" />
            }
            Emitir NF automática
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <FilterEmptyState
          message="Nenhuma emissão encontrada para o filtro selecionado."
          onClear={hasActiveFilters ? () => { setStatusFilter("all"); setNfFilter("all"); } : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Lista de emissões">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500">ID</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Franqueado</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Valor</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-center">NF</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className={cn(
                      "border-b border-gray-50 transition-colors",
                      selected.has(e.id) ? "bg-blue-50/30" : "hover:bg-gray-50/50"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${e.franqueado}`}
                        checked={selected.has(e.id)}
                        onChange={() => toggleSelect(e.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{e.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{e.franqueado}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">{fmt(e.valor)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-xs", e.nf ? "text-emerald-600" : "text-gray-300")}>{e.nf ? "✓" : "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full", STATUS_COLORS[e.status])}>
                        {STATUS_ICONS[e.status]} {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {selected.size > 0 ? `${selected.size} selecionadas · ` : ""}{filtered.length} de {EMISSAO_DATA.length} emissões · {periodLabel}
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(v: number) {
  return `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
