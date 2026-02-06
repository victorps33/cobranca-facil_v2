"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { StatCard } from "@/components/layout/StatCard";
import { cn } from "@/lib/cn";
import { cobrancasDummy, type Cobranca } from "@/lib/data/cobrancas-dummy";
import {
  Search,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  FileText,
  Download,
  Send,
  MoreHorizontal,
  CreditCard,
  QrCode,
} from "lucide-react";

const STATUS_COLORS: Record<Cobranca["status"], string> = {
  Aberta: "bg-blue-50 text-blue-700",
  Vencida: "bg-red-50 text-red-700",
  Paga: "bg-emerald-50 text-emerald-700",
  Cancelada: "bg-gray-100 text-gray-500",
};

const PAYMENT_ICONS: Record<Cobranca["formaPagamento"], React.ReactNode> = {
  Boleto: <FileText className="h-3.5 w-3.5" />,
  Pix: <QrCode className="h-3.5 w-3.5" />,
  Cartão: <CreditCard className="h-3.5 w-3.5" />,
};

function getCurrentPeriodLabel(): string {
  const now = new Date();
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${months[now.getMonth()]}/${String(now.getFullYear()).slice(-2)}`;
}

type SortKey = "dataVencimento" | "valorOriginal" | "cliente";
type SortDir = "asc" | "desc";

export default function CobrancasPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("dataVencimento");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    let list = [...cobrancasDummy];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.cliente.toLowerCase().includes(q) ||
          c.descricao.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (categoriaFilter !== "all") list = list.filter((c) => c.categoria === categoriaFilter);

    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    return list;
  }, [search, statusFilter, categoriaFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setCategoriaFilter("all");
  }

  const hasActiveFilters = search !== "" || statusFilter !== "all" || categoriaFilter !== "all";
  const periodLabel = `Competência: ${getCurrentPeriodLabel()}`;

  // Aggregated stats
  const totalEmitido = cobrancasDummy.reduce((s, c) => s + c.valorOriginal, 0);
  const totalRecebido = cobrancasDummy.reduce((s, c) => s + c.valorPago, 0);
  const totalAberto = cobrancasDummy.filter((c) => c.status === "Aberta").reduce((s, c) => s + c.valorAberto, 0);
  const totalVencido = cobrancasDummy.filter((c) => c.status === "Vencida").reduce((s, c) => s + c.valorAberto, 0);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3 opacity-30" />
    );

  function isOverdue(dateStr: string, status: string): boolean {
    if (status !== "Vencida") return false;
    return new Date(dateStr) < new Date();
  }

  return (
    <div className="space-y-6">
      {/* ── Single Page Header ── */}
      <PageHeader
        title="Cobranças"
        subtitle={`${cobrancasDummy.length} cobranças no período`}
        period={periodLabel}
        primaryAction={{ label: "Nova Cobrança", href: "/cobrancas/nova" }}
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-gray-400" />}
          label="Total Emitido"
          value={`R$ ${(totalEmitido / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          caption={`${getCurrentPeriodLabel()} · acumulado`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-gray-400" />}
          label="Total Recebido"
          value={`R$ ${(totalRecebido / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          caption={`${getCurrentPeriodLabel()} · até hoje`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-gray-400" />}
          label="Em Aberto"
          value={`R$ ${(totalAberto / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          caption={`${getCurrentPeriodLabel()} · a vencer`}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-gray-400" />}
          label="Vencido"
          value={`R$ ${(totalVencido / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          caption={`${getCurrentPeriodLabel()} · requer ação`}
          danger={totalVencido > 0}
        />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            name="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, descrição ou ID…"
            aria-label="Buscar cobranças"
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus-visible:ring-2 focus-visible:ring-[#85ace6]/30 focus-visible:border-[#85ace6] transition-colors"
          />
        </div>
        {/* Status pills */}
        <div className="flex items-center gap-1.5">
          {["all", "Aberta", "Vencida", "Paga", "Cancelada"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                statusFilter === s
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {s === "all" ? "Todos" : s}
            </button>
          ))}
        </div>
        {/* Category pills */}
        <div className="flex items-center gap-1.5">
          {["all", "Royalties", "FNP", "Taxa de Franquia"].map((c) => (
            <button
              key={c}
              onClick={() => setCategoriaFilter(c)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                categoriaFilter === c
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {c === "all" ? "Todas" : c}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table or Empty State ── */}
      {filtered.length === 0 ? (
        <FilterEmptyState
          message={
            hasActiveFilters
              ? "Nenhuma cobrança encontrada para os filtros selecionados."
              : "Nenhuma cobrança emitida neste período."
          }
          onClear={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Lista de cobranças">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500">Cobrança</th>
                  <th className="px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("cliente")} className="inline-flex items-center gap-1">
                      Cliente <SortIcon k="cliente" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("dataVencimento")} className="inline-flex items-center gap-1">
                      Vencimento <SortIcon k="dataVencimento" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">
                    <button onClick={() => toggleSort("valorOriginal")} className="inline-flex items-center gap-1">
                      Valor <SortIcon k="valorOriginal" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500">Pagamento</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-center">NF</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-sm">{c.id}</p>
                      <p className="text-xs text-gray-400">{c.categoria}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{c.cliente}</td>
                    <td className={cn(
                      "px-4 py-3 text-sm",
                      isOverdue(c.dataVencimento, c.status) ? "text-red-600 font-medium" : "text-gray-600"
                    )}>
                      {new Date(c.dataVencimento).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900 font-medium tabular-nums">
                      R$ {(c.valorOriginal / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                        {PAYMENT_ICONS[c.formaPagamento]}
                        {c.formaPagamento}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2.5 py-1 text-xs font-medium rounded-full", STATUS_COLORS[c.status])}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-xs", c.nfEmitida ? "text-emerald-600" : "text-gray-300")}>
                        {c.nfEmitida ? "✓" : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Download">
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Reenviar">
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Mais opções">
                          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} de {cobrancasDummy.length} cobranças · {periodLabel}
          </div>
        </div>
      )}
    </div>
  );
}
