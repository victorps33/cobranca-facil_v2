"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { StatCard } from "@/components/layout/StatCard";
import { cn } from "@/lib/cn";
import { cobrancasDummy, getCobrancasStats, type Cobranca } from "@/lib/data/cobrancas-dummy";
import { ciclosHistorico } from "@/lib/data/apuracao-historico-dummy";
import { EmitirNfDialog } from "@/components/cobrancas/EmitirNfDialog";
import { toast } from "@/components/ui/use-toast";
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

const NF_CATEGORIES: Cobranca["categoria"][] = ["Royalties", "FNP"];

// Competências derivadas dos ciclos de apuração
const competencias = ciclosHistorico.map((c) => ({
  label: c.competenciaShort,
  value: c.competencia,
}));

type SortKey = "dataVencimento" | "valorOriginal" | "cliente";
type SortDir = "asc" | "desc";

export default function CobrancasPage() {
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("dataVencimento");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Local state for NF overrides
  const [nfOverrides, setNfOverrides] = useState<Record<string, boolean>>({});

  // NF dialog state
  const [nfDialogOpen, setNfDialogOpen] = useState(false);
  const [nfDialogCobranca, setNfDialogCobranca] = useState<Cobranca | null>(null);

  // Dropdown menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenuId]);

  // Cobranças filtradas por competência (ou todas) com NF overrides
  const cobrancasFiltradas = useMemo(() => {
    const base = selectedCompetencia === "all"
      ? cobrancasDummy
      : cobrancasDummy.filter((c) => c.competencia === selectedCompetencia);
    return base.map((c) => ({
      ...c,
      nfEmitida: nfOverrides[c.id] ?? c.nfEmitida,
    }));
  }, [selectedCompetencia, nfOverrides]);

  const filtered = useMemo(() => {
    let list = [...cobrancasFiltradas];

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
  }, [search, statusFilter, categoriaFilter, sortKey, sortDir, cobrancasFiltradas]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setCategoriaFilter("all");
  }

  function handleEmitirNf(cobrancaId: string, comBoleto: boolean) {
    setNfOverrides((prev) => ({ ...prev, [cobrancaId]: true }));
    toast({
      title: "NF emitida com sucesso!",
      description: comBoleto
        ? "Nota fiscal e boleto avulso foram gerados."
        : "Nota fiscal emitida.",
    });
  }

  function openNfDialog(cobranca: Cobranca) {
    setNfDialogCobranca(cobranca);
    setNfDialogOpen(true);
    setOpenMenuId(null);
  }

  const hasActiveFilters = search !== "" || statusFilter !== "all" || categoriaFilter !== "all";
  const selectedLabel = selectedCompetencia === "all"
    ? "Todas"
    : competencias.find((c) => c.value === selectedCompetencia)?.label || "";
  const periodLabel = selectedCompetencia === "all"
    ? "Todas as competências"
    : `Competência: ${selectedLabel}`;

  // Stats da competência selecionada
  const stats = getCobrancasStats(cobrancasFiltradas);

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

  function canEmitNf(c: Cobranca): boolean {
    return !c.nfEmitida && NF_CATEGORIES.includes(c.categoria);
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Cobranças"
        subtitle={`${cobrancasFiltradas.length} cobranças no período`}
        period={periodLabel}
        primaryAction={{ label: "Nova Cobrança", href: "/cobrancas/nova" }}
      />

      {/* ── Filtros de competência ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setSelectedCompetencia("all")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
            selectedCompetencia === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          Todas
        </button>
        {competencias.map((comp) => (
          <button
            key={comp.value}
            onClick={() => setSelectedCompetencia(comp.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              comp.value === selectedCompetencia
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {comp.label}
          </button>
        ))}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-gray-400" />}
          label="Total Emitido"
          value={`R$ ${(stats.totalEmitido / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          caption={`${selectedLabel} · ${stats.total} cobranças`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-gray-400" />}
          label="Total Recebido"
          value={`R$ ${(stats.totalPago / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          caption={`${selectedLabel} · ${stats.byStatus.paga} pagas`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-gray-400" />}
          label="Em Aberto"
          value={`R$ ${(cobrancasFiltradas.filter((c) => c.status === "Aberta").reduce((s, c) => s + c.valorAberto, 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          caption={`${selectedLabel} · ${stats.byStatus.aberta} a vencer`}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-gray-400" />}
          label="Vencido"
          value={`R$ ${(stats.valorVencido / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          caption={`${selectedLabel} · ${stats.byStatus.vencida} vencidas`}
          danger={stats.valorVencido > 0}
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
                  <th className="px-4 py-3 font-medium text-gray-500">Pagamento</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">
                    <button onClick={() => toggleSort("valorOriginal")} className="inline-flex items-center gap-1">
                      Valor <SortIcon k="valorOriginal" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500">Forma</th>
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
                      {new Date(c.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {c.dataPagamento ? (
                        <span className="text-emerald-600">
                          {new Date(c.dataPagamento + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
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
                      {c.nfEmitida ? (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                          Emitida
                        </span>
                      ) : canEmitNf(c) ? (
                        <button
                          onClick={() => openNfDialog(c)}
                          className="text-xs font-medium text-[#F85B00] hover:text-[#e05200] transition-colors"
                        >
                          Emitir NF
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 relative" ref={openMenuId === c.id ? menuRef : undefined}>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Download">
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Reenviar">
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                          aria-label="Mais opções"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>

                        {/* Dropdown menu */}
                        {openMenuId === c.id && (
                          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                            {canEmitNf(c) && (
                              <button
                                onClick={() => openNfDialog(c)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Emitir NF
                              </button>
                            )}
                            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </button>
                            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                              <Send className="h-3.5 w-3.5" />
                              Reenviar
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} de {cobrancasFiltradas.length} cobranças · {periodLabel}
          </div>
        </div>
      )}

      {/* NF Dialog */}
      <EmitirNfDialog
        open={nfDialogOpen}
        onOpenChange={setNfDialogOpen}
        cobranca={nfDialogCobranca}
        onEmitir={handleEmitirNf}
      />
    </div>
  );
}
