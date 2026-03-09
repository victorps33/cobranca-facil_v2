"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { getFranqueadoraHeaders } from "@/lib/fetch-with-tenant";
import { useFranqueadora } from "@/components/providers/FranqueadoraProvider";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { DataEmptyState } from "@/components/layout/DataEmptyState";
import { FranqueadoraCard } from "@/components/franqueadora-card";
import { ImportDialog } from "@/components/franqueados/ImportDialog";
import type { Franqueado } from "@/lib/types";
import { exportFranqueadosToXlsx } from "@/lib/franqueados-import-export";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { SearchBar } from "@/components/ui/search-bar";
import {
  MapPin,
  Upload,
  Download,
  AlertTriangle,
  X,
  Users,
  RefreshCw,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/cn";

type StatusFilter = "Todos" | "Aberta" | "Fechada" | "Vendida";
type PageTab = "cadastro" | "perfil-risco";

const statusLojaConfig: Record<
  string,
  { dot: string; bg: string; text: string; avatarBg: string; avatarText: string }
> = {
  Aberta: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    avatarBg: "bg-emerald-50",
    avatarText: "text-emerald-700",
  },
  Fechada: {
    dot: "bg-red-500",
    bg: "bg-red-50",
    text: "text-red-700",
    avatarBg: "bg-red-50",
    avatarText: "text-red-600",
  },
  Vendida: {
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    avatarBg: "bg-amber-50",
    avatarText: "text-amber-700",
  },
};

const tabs: { label: string; value: StatusFilter }[] = [
  { label: "Todos", value: "Todos" },
  { label: "Abertas", value: "Aberta" },
  { label: "Fechadas", value: "Fechada" },
  { label: "Vendidas", value: "Vendida" },
];

/* ── Risk Profile types & config ── */

type RiskProfileKey = "BOM_PAGADOR" | "DUVIDOSO" | "MAU_PAGADOR";

interface RiskScoreEntry {
  id: string;
  customerId: string;
  defaultRate: number;
  avgDaysLate: number;
  totalOutstanding: number;
  riskProfile: RiskProfileKey;
  calculatedAt: string;
  customer: { id: string; name: string; email: string };
}

const RISK_BADGE_CONFIG: Record<
  RiskProfileKey,
  { label: string; className: string }
> = {
  BOM_PAGADOR: { label: "Bom Pagador", className: "bg-green-100 text-green-800" },
  DUVIDOSO: { label: "Duvidoso", className: "bg-yellow-100 text-yellow-800" },
  MAU_PAGADOR: { label: "Mau Pagador", className: "bg-red-100 text-red-800" },
};

const PAGE_TABS: { label: string; value: PageTab }[] = [
  { label: "Cadastro", value: "cadastro" },
  { label: "Perfil de Risco", value: "perfil-risco" },
];

export default function ClientesPage() {
  const { activeFranqueadoraId } = useFranqueadora();
  const [franqueados, setFranqueados] = useState<Franqueado[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [dupBannerDismissed, setDupBannerDismissed] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [activePageTab, setActivePageTab] = useState<PageTab>("cadastro");

  useEffect(() => {
    setLoading(true);
    fetch("/api/customers", { headers: getFranqueadoraHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFranqueados(data);
      })
      .finally(() => setLoading(false));
  }, [activeFranqueadoraId]);

  const counts = useMemo(() => {
    return {
      Todos: franqueados.length,
      Aberta: franqueados.filter((c) => c.statusLoja === "Aberta").length,
      Fechada: franqueados.filter((c) => c.statusLoja === "Fechada").length,
      Vendida: franqueados.filter((c) => c.statusLoja === "Vendida").length,
    };
  }, [franqueados]);

  const filtered = useMemo(() => {
    let result = franqueados;
    if (statusFilter !== "Todos") {
      result = result.filter((c) => c.statusLoja === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          (c.cidade && c.cidade.toLowerCase().includes(q)) ||
          (c.bairro && c.bairro.toLowerCase().includes(q)) ||
          (c.responsavel && c.responsavel.toLowerCase().includes(q)) ||
          c.cnpj.includes(q)
      );
    }
    return result;
  }, [statusFilter, searchQuery, franqueados]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery]);

  // Detect duplicate CNPJs within the full list
  const duplicateCnpjs = useMemo(() => {
    const cnpjCount: Record<string, number> = {};
    franqueados.forEach((f) => {
      if (!f.cnpj) return;
      cnpjCount[f.cnpj] = (cnpjCount[f.cnpj] ?? 0) + 1;
    });
    const dupes = new Set<string>();
    Object.entries(cnpjCount).forEach(([cnpj, count]) => {
      if (count > 1) dupes.add(cnpj);
    });
    return dupes;
  }, [franqueados]);

  function formatDate(dateStr: string) {
    return new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr));
  }

  function getInitials(nome: string) {
    return nome
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Clientes" />
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" />

      {/* Top-level page tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex items-center gap-6" aria-label="Seção da página">
          {PAGE_TABS.map((tab) => {
            const isActive = activePageTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActivePageTab(tab.value)}
                className={cn(
                  "pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                  isActive
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activePageTab === "cadastro" ? (
        <>
          {/* Seção: Franqueadora */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Franqueadora</h2>
            <FranqueadoraCard />
          </div>

          {/* Seção: Franqueados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Franqueados
                <span className="ml-2 text-sm font-normal text-muted-foreground">{counts.Todos} cadastrados</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setImportOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Importar
                </button>
                <button
                  onClick={() => exportFranqueadosToXlsx(filtered)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </button>
                <a
                  href="/clientes/novo"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors"
                >
                  Novo Franqueado
                </a>
              </div>
            </div>
          </div>

          {franqueados.length === 0 ? (
            <DataEmptyState
              title="Nenhum franqueado cadastrado"
              description="Cadastre seus franqueados para começar a gerenciar cobranças e apurações."
              actionLabel="Novo Franqueado"
              actionHref="/clientes/novo"
              secondaryActionLabel="Importar"
              secondaryActionOnClick={() => setImportOpen(true)}
              icon={<Users className="h-6 w-6 text-gray-400" />}
            />
          ) : (
            <>
              {/* Duplicate CNPJ warning banner */}
              {duplicateCnpjs.size > 0 && !dupBannerDismissed && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800">
                      {duplicateCnpjs.size} CNPJ{duplicateCnpjs.size !== 1 ? "s" : ""} duplicado{duplicateCnpjs.size !== 1 ? "s" : ""} detectado{duplicateCnpjs.size !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {Array.from(duplicateCnpjs).join(", ")}
                    </p>
                  </div>
                  <button
                    onClick={() => setDupBannerDismissed(true)}
                    className="text-amber-400 hover:text-amber-600 transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Table card */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Search + Tab bar */}
                <div className="px-4 pt-4 pb-3">
                  <SearchBar
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Buscar por nome, cidade, bairro, responsável ou CNPJ…"
                    wrapperClassName="max-w-sm"
                  />
                </div>

                <div className="border-b border-gray-100">
                  <div className="px-4">
                    <nav className="flex items-center gap-6" aria-label="Filtrar por status">
                      {tabs.map((tab) => {
                        const isActive = statusFilter === tab.value;
                        return (
                          <button
                            key={tab.value}
                            onClick={() => setStatusFilter(tab.value)}
                            className={cn(
                              "pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                              isActive
                                ? "border-gray-900 text-gray-900"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                            )}
                            aria-current={isActive ? "page" : undefined}
                          >
                            {tab.label}
                            <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                              {counts[tab.value]}
                            </span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <FilterEmptyState
                    message={`Nenhum franqueado com status "${statusFilter.toLowerCase()}".`}
                    onClear={
                      statusFilter !== "Todos"
                        ? () => setStatusFilter("Todos")
                        : undefined
                    }
                    clearLabel="Ver todos"
                  />
                ) : (
                  <>
                    <div className="overflow-x-auto min-h-[480px]">
                      <table className="w-full min-w-[640px] text-sm" aria-label="Lista de franqueados">
                        <thead>
                          <tr className="border-b border-gray-100 text-left">
                            <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">
                              Franqueado
                            </th>
                            <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">
                              Responsável
                            </th>
                            <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">
                              Localização
                            </th>
                            <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">
                              Status
                            </th>
                            <th className="px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wide text-right">
                              Abertura
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedRows.map((c) => {
                            const config = statusLojaConfig[c.statusLoja] || statusLojaConfig.Aberta;
                            return (
                              <tr
                                key={c.id}
                                className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                              >
                                <td className="px-4 py-3">
                                  <Link
                                    href={`/clientes/${c.id}`}
                                    className="flex items-center gap-3 group"
                                  >
                                    <div
                                      className={cn(
                                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                                        config.avatarBg,
                                        config.avatarText
                                      )}
                                    >
                                      {getInitials(c.nome)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-gray-900 text-sm truncate group-hover:text-primary transition-colors">
                                        {c.nome}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {c.cnpj} · {c.razaoSocial}
                                        {c.cnpj && duplicateCnpjs.has(c.cnpj) && (
                                          <span className="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700">
                                            Duplicado
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </Link>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="min-w-0">
                                    <p className="text-sm text-gray-900 truncate">
                                      {c.responsavel || "—"}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {c.email}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {c.cidade ? (
                                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                      <MapPin className="h-3.5 w-3.5 text-gray-300 shrink-0" aria-hidden="true" />
                                      <span className="truncate">
                                        {c.cidade}/{c.estado}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-300">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                                      config.bg,
                                      config.text
                                    )}
                                  >
                                    <span
                                      className={cn("h-1.5 w-1.5 rounded-full", config.dot)}
                                      aria-hidden="true"
                                    />
                                    {c.statusLoja}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 tabular-nums text-right">
                                  {c.dataAbertura ? formatDate(c.dataAbertura) : "—"}
                                </td>
                              </tr>
                            );
                          })}
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
                  </>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <RiskProfileView />
      )}

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingFranqueados={franqueados}
        onImport={(rows) => {
          setFranqueados((prev) => [...prev, ...rows]);
          setDupBannerDismissed(false);
        }}
      />
    </div>
  );
}

/* ── Risk Profile View ── */

type RiskSortField = "name" | "defaultRate" | "avgDaysLate" | "totalOutstanding" | "riskProfile";
type SortDir = "asc" | "desc";

const RISK_PROFILE_ORDER: Record<RiskProfileKey, number> = {
  BOM_PAGADOR: 0,
  DUVIDOSO: 1,
  MAU_PAGADOR: 2,
};

function formatBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

function RiskProfileView() {
  const { activeFranqueadoraId } = useFranqueadora();
  const [scores, setScores] = useState<RiskScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [sortField, setSortField] = useState<RiskSortField>("riskProfile");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/risk-scores", {
        headers: getFranqueadoraHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setScores(data);
      }
    } catch (err) {
      console.error("Failed to fetch risk scores:", err);
    } finally {
      setLoading(false);
    }
  }, [activeFranqueadoraId]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      const res = await fetch("/api/risk-scores/recalculate", {
        method: "POST",
        headers: getFranqueadoraHeaders(),
      });
      if (res.ok) {
        await fetchScores();
      }
    } catch (err) {
      console.error("Failed to recalculate risk scores:", err);
    } finally {
      setRecalculating(false);
    }
  }

  function handleSort(field: RiskSortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const list = [...scores];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = (a.customer.name || "").localeCompare(b.customer.name || "");
          break;
        case "defaultRate":
          cmp = a.defaultRate - b.defaultRate;
          break;
        case "avgDaysLate":
          cmp = a.avgDaysLate - b.avgDaysLate;
          break;
        case "totalOutstanding":
          cmp = a.totalOutstanding - b.totalOutstanding;
          break;
        case "riskProfile":
          cmp = RISK_PROFILE_ORDER[a.riskProfile] - RISK_PROFILE_ORDER[b.riskProfile];
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [scores, sortField, sortDir]);

  function SortIcon({ field }: { field: RiskSortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-300" />;
    }
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1 text-gray-700" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1 text-gray-700" />
    );
  }

  if (loading) {
    return <TableSkeleton rows={8} cols={5} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-gray-500" />
            Perfil de Risco
            <span className="text-sm font-normal text-muted-foreground">
              {scores.length} franqueado{scores.length !== 1 ? "s" : ""}
            </span>
          </h2>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full transition-colors",
            recalculating
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          )}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", recalculating && "animate-spin")}
          />
          {recalculating ? "Recalculando..." : "Recalcular Scores"}
        </button>
      </div>

      {scores.length === 0 ? (
        <DataEmptyState
          title="Nenhum score de risco calculado"
          description="Clique em 'Recalcular Scores' para gerar os perfis de risco dos franqueados."
          icon={<ShieldAlert className="h-6 w-6 text-gray-400" />}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm" aria-label="Perfil de risco dos franqueados">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3">
                    <button
                      onClick={() => handleSort("name")}
                      className="inline-flex items-center font-medium text-xs text-muted-foreground uppercase tracking-wide hover:text-gray-700 transition-colors"
                    >
                      Nome
                      <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSort("defaultRate")}
                      className="inline-flex items-center font-medium text-xs text-muted-foreground uppercase tracking-wide hover:text-gray-700 transition-colors"
                    >
                      Taxa Inadimpl.
                      <SortIcon field="defaultRate" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSort("avgDaysLate")}
                      className="inline-flex items-center font-medium text-xs text-muted-foreground uppercase tracking-wide hover:text-gray-700 transition-colors"
                    >
                      Dias Médio Atraso
                      <SortIcon field="avgDaysLate" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSort("totalOutstanding")}
                      className="inline-flex items-center font-medium text-xs text-muted-foreground uppercase tracking-wide hover:text-gray-700 transition-colors"
                    >
                      Valor em Aberto
                      <SortIcon field="totalOutstanding" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      onClick={() => handleSort("riskProfile")}
                      className="inline-flex items-center font-medium text-xs text-muted-foreground uppercase tracking-wide hover:text-gray-700 transition-colors"
                    >
                      Perfil de Risco
                      <SortIcon field="riskProfile" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => {
                  const badge = RISK_BADGE_CONFIG[s.riskProfile] || RISK_BADGE_CONFIG.DUVIDOSO;
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/clientes/${s.customerId}`}
                          className="font-medium text-gray-900 text-sm hover:text-primary transition-colors"
                        >
                          {s.customer.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 tabular-nums text-right">
                        {s.defaultRate.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 tabular-nums text-right">
                        {s.avgDaysLate.toFixed(1)} dias
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 tabular-nums text-right">
                        {formatBRL(s.totalOutstanding)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
