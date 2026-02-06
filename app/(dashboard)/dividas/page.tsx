"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { StatCard } from "@/components/layout/StatCard";
import { cn } from "@/lib/cn";
import {
  AlertTriangle,
  DollarSign,
  Clock,
  TrendingDown,
  Search,
  Phone,
  Mail,
  FileWarning,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function getCurrentPeriodLabel(): string {
  const now = new Date();
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[now.getMonth()]}/${String(now.getFullYear()).slice(-2)}`;
}

interface Divida {
  id: string;
  franqueado: string;
  valorTotal: number;
  diasAtraso: number;
  cobrancasVencidas: number;
  ultimoContato: string;
  risco: "Baixo" | "Médio" | "Alto" | "Crítico";
}

const DIVIDAS_DATA: Divida[] = [
  { id: "D001", franqueado: "Franquia Santo Amaro", valorTotal: 78000, diasAtraso: 45, cobrancasVencidas: 3, ultimoContato: "2026-01-28", risco: "Alto" },
  { id: "D002", franqueado: "Franquia Campo Belo", valorTotal: 35000, diasAtraso: 15, cobrancasVencidas: 1, ultimoContato: "2026-02-01", risco: "Médio" },
  { id: "D003", franqueado: "Franquia Moema", valorTotal: 27500, diasAtraso: 8, cobrancasVencidas: 1, ultimoContato: "2026-02-03", risco: "Baixo" },
  { id: "D004", franqueado: "Franquia Saúde", valorTotal: 47500, diasAtraso: 60, cobrancasVencidas: 4, ultimoContato: "2026-01-15", risco: "Crítico" },
  { id: "D005", franqueado: "Franquia Jabaquara", valorTotal: 22000, diasAtraso: 30, cobrancasVencidas: 2, ultimoContato: "2026-01-20", risco: "Alto" },
];

const RISCO_COLORS: Record<Divida["risco"], string> = {
  Baixo: "bg-blue-50 text-blue-700",
  Médio: "bg-amber-50 text-amber-700",
  Alto: "bg-orange-50 text-orange-700",
  Crítico: "bg-red-50 text-red-700",
};

type SortKey = "diasAtraso" | "valorTotal" | "franqueado";
type SortDir = "asc" | "desc";

export default function DividasPage() {
  const [search, setSearch] = useState("");
  const [riscoFilter, setRiscoFilter] = useState("all");
  const [atrasoFilter, setAtrasoFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("diasAtraso");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    let list = [...DIVIDAS_DATA];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.franqueado.toLowerCase().includes(q));
    }
    if (riscoFilter !== "all") list = list.filter((d) => d.risco === riscoFilter);
    if (atrasoFilter === "0-30") list = list.filter((d) => d.diasAtraso <= 30);
    else if (atrasoFilter === "31-60") list = list.filter((d) => d.diasAtraso > 30 && d.diasAtraso <= 60);
    else if (atrasoFilter === ">60") list = list.filter((d) => d.diasAtraso > 60);
    list.sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === "string") return sortDir === "asc" ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [search, riscoFilter, atrasoFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function clearFilters() { setSearch(""); setRiscoFilter("all"); setAtrasoFilter("all"); }
  const hasActiveFilters = search !== "" || riscoFilter !== "all" || atrasoFilter !== "all";

  const totalDivida = DIVIDAS_DATA.reduce((s, d) => s + d.valorTotal, 0);
  const avgAtraso = Math.round(DIVIDAS_DATA.reduce((s, d) => s + d.diasAtraso, 0) / DIVIDAS_DATA.length);
  const criticos = DIVIDAS_DATA.filter((d) => d.risco === "Crítico" || d.risco === "Alto").length;

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
      : <ChevronDown className="h-3 w-3 opacity-30" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dívidas"
        subtitle="Acompanhamento de inadimplência e recuperação"
        period={`Posição: ${getCurrentPeriodLabel()}`}
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign className="h-4 w-4 text-gray-400" />} label="Total Inadimplente" value={fmt(totalDivida)} danger />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-gray-400" />} label="Franqueados" value={`${DIVIDAS_DATA.length}`} caption="com pendências" />
        <StatCard icon={<Clock className="h-4 w-4 text-gray-400" />} label="Atraso Médio" value={`${avgAtraso} dias`} />
        <StatCard icon={<TrendingDown className="h-4 w-4 text-gray-400" />} label="Alto Risco / Crítico" value={`${criticos}`} caption="requerem ação imediata" danger={criticos > 0} />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
          <input type="search" name="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar franqueado…"
            aria-label="Buscar dívidas"
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus-visible:ring-2 focus-visible:ring-[#85ace6]/30 focus-visible:border-[#85ace6] transition-colors" />
        </div>
        <div className="flex items-center gap-1.5">
          {["all", "Baixo", "Médio", "Alto", "Crítico"].map((r) => (
            <button key={r} onClick={() => setRiscoFilter(r)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                riscoFilter === r ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {r === "all" ? "Todos" : r}
            </button>
          ))}
        </div>
        {/* Atraso range pills */}
        <div className="flex items-center gap-1.5">
          {[
            { key: "all", label: "Qualquer atraso" },
            { key: "0-30", label: "0–30 dias" },
            { key: "31-60", label: "31–60 dias" },
            { key: ">60", label: "> 60 dias" },
          ].map((a) => (
            <button key={a.key} onClick={() => setAtrasoFilter(a.key)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                atrasoFilter === a.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <FilterEmptyState
          message={hasActiveFilters ? "Nenhuma dívida encontrada para os filtros atuais." : "Nenhuma dívida registrada. Ótima notícia!"}
          onClear={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Lista de dívidas">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500">Franqueado</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">
                    <button onClick={() => toggleSort("valorTotal")} className="inline-flex items-center gap-1">Valor <SortIcon k="valorTotal" /></button>
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">
                    <button onClick={() => toggleSort("diasAtraso")} className="inline-flex items-center gap-1">Dias Atraso <SortIcon k="diasAtraso" /></button>
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-center">Cobranças</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Último Contato</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Risco</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{d.franqueado}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600 tabular-nums">{fmt(d.valorTotal)}</td>
                    <td className={cn("px-4 py-3 text-right font-medium tabular-nums", d.diasAtraso > 30 ? "text-red-600" : "text-amber-600")}>{d.diasAtraso}d</td>
                    <td className="px-4 py-3 text-center text-gray-600">{d.cobrancasVencidas}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(d.ultimoContato).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2.5 py-1 text-xs font-medium rounded-full", RISCO_COLORS[d.risco])}>{d.risco}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Ligar">
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Enviar e-mail">
                          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Protestar">
                          <FileWarning className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} de {DIVIDAS_DATA.length} inadimplentes
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(v: number) { return `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`; }
