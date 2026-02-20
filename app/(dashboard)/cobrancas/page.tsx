"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { DataEmptyState } from "@/components/layout/DataEmptyState";
import { MetricCard } from "@/components/ui/metric-card";
import { Pagination } from "@/components/ui/pagination";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { cn } from "@/lib/cn";
import type { Cobranca } from "@/lib/types";
import { getStatusClasses } from "@/components/ui/status-badge";
import { EmitirNfDialog } from "@/components/cobrancas/EmitirNfDialog";
import { toast } from "@/components/ui/use-toast";
import { KpiSkeleton } from "@/components/ui/skeleton";
import { SearchBar } from "@/components/ui/search-bar";
import {
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
  Receipt,
} from "lucide-react";

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  Boleto: <FileText className="h-3.5 w-3.5" />,
  Pix: <QrCode className="h-3.5 w-3.5" />,
  Cartão: <CreditCard className="h-3.5 w-3.5" />,
};

const NF_CATEGORIES = ["Royalties", "FNP"];

type SortKey = "dataVencimento" | "valorOriginal" | "cliente";
type SortDir = "asc" | "desc";

export default function CobrancasPage() {
  const router = useRouter();
  const [allCobrancas, setAllCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("dataVencimento");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [nfOverrides, setNfOverrides] = useState<Record<string, boolean>>({});
  const [nfDialogOpen, setNfDialogOpen] = useState(false);
  const [nfDialogCobranca, setNfDialogCobranca] = useState<Cobranca | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    fetch("/api/charges")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllCobrancas(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        openMenuId &&
        menuRefs.current[openMenuId] &&
        !menuRefs.current[openMenuId]!.contains(e.target as Node)
      ) {
        setOpenMenuId(null);
      }
    }
    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenuId]);

  // Derive competências from data
  const competencias = useMemo(() => {
    const set = new Set<string>();
    allCobrancas.forEach((c) => { if (c.competencia) set.add(c.competencia); });
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return Array.from(set).sort((a, b) => {
      const [mesA, anoA] = a.split("/");
      const [mesB, anoB] = b.split("/");
      return (parseInt(anoB) * 12 + meses.indexOf(mesB)) - (parseInt(anoA) * 12 + meses.indexOf(mesA));
    }).map((c) => {
      const [mes, ano] = c.split("/");
      return { label: `${mes}/${ano.slice(2)}`, value: c };
    });
  }, [allCobrancas]);

  const cobrancasFiltradas = useMemo(() => {
    const base = selectedCompetencia === "all"
      ? allCobrancas
      : allCobrancas.filter((c) => c.competencia === selectedCompetencia);
    return base.map((c) => ({
      ...c,
      nfEmitida: nfOverrides[c.id] ?? c.nfEmitida,
    }));
  }, [selectedCompetencia, nfOverrides, allCobrancas]);

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

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoriaFilter, selectedCompetencia, sortKey, sortDir]);

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

  // Stats
  const stats = useMemo(() => {
    const totalEmitido = cobrancasFiltradas.reduce((s, c) => s + c.valorOriginal, 0);
    const totalPago = cobrancasFiltradas.filter((c) => c.status === "Paga").reduce((s, c) => s + c.valorOriginal, 0);
    const abertas = cobrancasFiltradas.filter((c) => c.status === "Aberta");
    const vencidas = cobrancasFiltradas.filter((c) => c.status === "Vencida");
    const valorAberto = abertas.reduce((s, c) => s + c.valorAberto, 0);
    const valorVencido = vencidas.reduce((s, c) => s + c.valorAberto, 0);
    return {
      total: cobrancasFiltradas.length,
      totalEmitido,
      totalPago,
      valorAberto,
      valorVencido,
      aberta: abertas.length,
      paga: cobrancasFiltradas.filter((c) => c.status === "Paga").length,
      vencida: vencidas.length,
    };
  }, [cobrancasFiltradas]);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cobranças" />
        <KpiSkeleton count={4} />
      </div>
    );
  }

  if (allCobrancas.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cobranças"
          primaryAction={{ label: "Nova Cobrança", href: "/cobrancas/nova" }}
        />
        <DataEmptyState
          title="Nenhuma cobrança encontrada"
          description="Crie sua primeira cobrança para começar a gerenciar seus recebimentos."
          actionLabel="Nova Cobrança"
          actionHref="/cobrancas/nova"
          icon={<Receipt className="h-6 w-6 text-gray-400" />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <PageHeader
          title="Cobranças"
          period={periodLabel}
          primaryAction={{ label: "Nova Cobrança", href: "/cobrancas/nova" }}
        />

        <FilterPillGroup
          options={[
            { key: "all", label: "Todas" },
            ...competencias.map((c) => ({ key: c.value, label: c.label })),
          ]}
          value={selectedCompetencia}
          onChange={setSelectedCompetencia}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            className="animate-in stagger-1"
            icon={<DollarSign className="h-4 w-4" />}
            title="Total Emitido"
            value={`R$ ${(stats.totalEmitido / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            subtitle={`${selectedLabel} · ${stats.total} cobranças`}
          />
          <MetricCard
            className="animate-in stagger-2"
            icon={<TrendingUp className="h-4 w-4" />}
            title="Total Recebido"
            value={`R$ ${(stats.totalPago / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            subtitle={`${selectedLabel} · ${stats.paga} pagas`}
          />
          <MetricCard
            className="animate-in stagger-3"
            icon={<Clock className="h-4 w-4" />}
            title="Em Aberto"
            value={`R$ ${(stats.valorAberto / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            subtitle={`${selectedLabel} · ${stats.aberta} a vencer`}
          />
          <MetricCard
            className="animate-in stagger-4"
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Vencido"
            value={`R$ ${(stats.valorVencido / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            subtitle={`${selectedLabel} · ${stats.vencida} vencidas`}
            variant={stats.valorVencido > 0 ? "danger" : "default"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar por cliente, descrição ou ID…"
            wrapperClassName="flex-1 min-w-[200px] max-w-sm"
          />
          <FilterPillGroup
            options={[
              { key: "all", label: "Todos" },
              { key: "Aberta", label: "Aberta" },
              { key: "Vencida", label: "Vencida" },
              { key: "Paga", label: "Paga" },
              { key: "Cancelada", label: "Cancelada" },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <FilterPillGroup
            options={[
              { key: "all", label: "Todas" },
              { key: "Royalties", label: "Royalties" },
              { key: "FNP", label: "FNP" },
              { key: "Taxa de Franquia", label: "Taxa de Franquia" },
            ]}
            value={categoriaFilter}
            onChange={setCategoriaFilter}
          />
        </div>
      </div>

      <div>
        {filtered.length === 0 ? (
          <FilterEmptyState
            message={
              hasActiveFilters
                ? "Nenhuma cobrança encontrada para os filtros selecionados."
                : "Nenhuma cobrança emitida neste período."
            }
            suggestion={
              hasActiveFilters
                ? "Tente ajustar os filtros ou selecionar outro período."
                : "Crie sua primeira cobrança para começar."
            }
            onClear={hasActiveFilters ? clearFilters : undefined}
            actionLabel={!hasActiveFilters ? "Nova Cobrança" : undefined}
            actionHref={!hasActiveFilters ? "/cobrancas/nova" : undefined}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm" aria-label="Lista de cobranças">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">Cobrança</th>
                    <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">
                      <button onClick={() => toggleSort("cliente")} className="inline-flex items-center gap-1">
                        Cliente <SortIcon k="cliente" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">
                      <button onClick={() => toggleSort("dataVencimento")} className="inline-flex items-center gap-1">
                        Vencimento <SortIcon k="dataVencimento" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">Pagamento</th>
                    <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide text-right">
                      <button onClick={() => toggleSort("valorOriginal")} className="inline-flex items-center gap-1">
                        Valor <SortIcon k="valorOriginal" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">Forma</th>
                    <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide text-center">NF</th>
                    <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((c) => (
                    <tr key={c.id} onClick={() => router.push(`/cobrancas/${c.id}`)} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">{c.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{c.categoria}</p>
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
                          {PAYMENT_ICONS[c.formaPagamento] || null}
                          {c.formaPagamento}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2.5 py-1 text-xs font-medium rounded-full border", getStatusClasses(c.status))}>
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
                            onClick={(e) => { e.stopPropagation(); openNfDialog(c); }}
                            className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                          >
                            Emitir NF
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 relative" ref={(el) => { menuRefs.current[c.id] = el; }}>
                          <button onClick={(e) => { e.stopPropagation(); toast({ title: "Em breve", description: "Funcionalidade de download será disponibilizada em breve." }); }} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Download">
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); toast({ title: "Em breve", description: "Funcionalidade de reenvio será disponibilizada em breve." }); }} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Reenviar">
                            <Send className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                            aria-label="Mais opções"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>

                          {openMenuId === c.id && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-large py-1 min-w-[160px]">
                              {canEmitNf(c) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openNfDialog(c); }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Emitir NF
                                </button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); toast({ title: "Em breve", description: "Funcionalidade de download será disponibilizada em breve." }); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); toast({ title: "Em breve", description: "Funcionalidade de reenvio será disponibilizada em breve." }); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
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
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <EmitirNfDialog
        open={nfDialogOpen}
        onOpenChange={setNfDialogOpen}
        cobranca={nfDialogCobranca}
        onEmitir={handleEmitirNf}
      />
    </div>
  );
}
