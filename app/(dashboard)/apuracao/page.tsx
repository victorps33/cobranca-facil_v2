"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { StatCard } from "@/components/layout/StatCard";
import { cn } from "@/lib/cn";
import {
  Calculator,
  DollarSign,
  FileCheck,
  TrendingUp,
  ChevronRight,
  Eye,
} from "lucide-react";

function getCurrentPeriodLabel(): string {
  const now = new Date();
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${months[now.getMonth()]}/${String(now.getFullYear()).slice(-2)}`;
}

const APURACAO_DATA = [
  { id: "1", franqueado: "Franquia Morumbi", royalties: 45000, fnp: 12000, total: 57000, status: "Aprovada" as const },
  { id: "2", franqueado: "Franquia Vila Mariana", royalties: 38000, fnp: 9500, total: 47500, status: "Aprovada" as const },
  { id: "3", franqueado: "Franquia Santo Amaro", royalties: 32000, fnp: 8000, total: 40000, status: "Pendente" as const },
  { id: "4", franqueado: "Franquia Campo Belo", royalties: 28000, fnp: 7000, total: 35000, status: "Pendente" as const },
  { id: "5", franqueado: "Franquia Itaim Bibi", royalties: 52000, fnp: 13000, total: 65000, status: "Aprovada" as const },
  { id: "6", franqueado: "Franquia Moema", royalties: 22000, fnp: 5500, total: 27500, status: "Em revisão" as const },
  { id: "7", franqueado: "Franquia Brooklin", royalties: 41000, fnp: 10250, total: 51250, status: "Aprovada" as const },
  { id: "8", franqueado: "Franquia Saúde", royalties: 19000, fnp: 4750, total: 23750, status: "Pendente" as const },
];

const STATUS_COLORS: Record<string, string> = {
  "Aprovada": "bg-emerald-50 text-emerald-700",
  "Pendente": "bg-amber-50 text-amber-700",
  "Em revisão": "bg-blue-50 text-blue-700",
};

export default function ApuracaoPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [competencia, setCompetencia] = useState(getCurrentPeriodLabel());
  const periodLabel = `Competência: ${competencia}`;

  const filtered = statusFilter === "all"
    ? APURACAO_DATA
    : APURACAO_DATA.filter((a) => a.status === statusFilter);

  const totalRoyalties = APURACAO_DATA.reduce((s, a) => s + a.royalties, 0);
  const totalFnp = APURACAO_DATA.reduce((s, a) => s + a.fnp, 0);
  const totalGeral = APURACAO_DATA.reduce((s, a) => s + a.total, 0);
  const aprovadas = APURACAO_DATA.filter((a) => a.status === "Aprovada").length;

  const hasActiveFilters = statusFilter !== "all";

  return (
    <div className="space-y-6">
      {/* ── Single Page Header ── */}
      <PageHeader
        title="Apuração"
        subtitle="Consolidação de royalties e FNP por franqueado"
        period={periodLabel}
        primaryAction={{ label: "Nova Apuração", onClick: () => {} }}
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign className="h-4 w-4 text-gray-400" />} label="Total Royalties" value={fmt(totalRoyalties)} caption={periodLabel} />
        <StatCard icon={<Calculator className="h-4 w-4 text-gray-400" />} label="Total FNP" value={fmt(totalFnp)} caption={periodLabel} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-gray-400" />} label="Total Geral" value={fmt(totalGeral)} caption="royalties + FNP" />
        <StatCard icon={<FileCheck className="h-4 w-4 text-gray-400" />} label="Aprovadas" value={`${aprovadas}/${APURACAO_DATA.length}`} caption="apurações" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Competence pills */}
        <div className="flex items-center gap-1.5">
          {[getCurrentPeriodLabel(), "Jan/26", "Dez/25", "Nov/25"].map((comp) => (
            <button
              key={comp}
              onClick={() => setCompetencia(comp)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                competencia === comp
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {comp}
            </button>
          ))}
        </div>
        {/* Status pills */}
        <div className="flex items-center gap-1.5">
          {["all", "Aprovada", "Pendente", "Em revisão"].map((s) => (
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
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <FilterEmptyState
          message="Nenhuma apuração encontrada para o filtro selecionado."
          onClear={hasActiveFilters ? () => setStatusFilter("all") : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Lista de apurações">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500">Franqueado</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Royalties</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">FNP</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.franqueado}</td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{fmt(a.royalties)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{fmt(a.fnp)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">{fmt(a.total)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2.5 py-1 text-xs font-medium rounded-full", STATUS_COLORS[a.status])}>{a.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Ver detalhes">
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} de {APURACAO_DATA.length} apurações · {periodLabel}
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(v: number) {
  return `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
