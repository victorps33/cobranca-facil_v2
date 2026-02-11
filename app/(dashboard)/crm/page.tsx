"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { StatCard } from "@/components/layout/StatCard";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/use-toast";
import { CrmDashboard } from "@/components/crm/CrmDashboard";
import { exportCrmClientsToXlsx } from "@/lib/crm-export";
import type { CrmCustomer } from "@/lib/types/crm";
import { Skeleton, KpiSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Search, Users, AlertTriangle, DollarSign, ListTodo, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";

type SortKey = "nome" | "status" | "valorAberto" | "totalVencido" | "qtdTarefasAbertas" | "ultimaInteracao";
type SortDir = "asc" | "desc";

const healthOrder: Record<string, number> = {
  Crítico: 0,
  "Exige Atenção": 1,
  Controlado: 2,
  Saudável: 3,
};

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  Saudável:        { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Controlado:      { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  "Exige Atenção": { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  Crítico:         { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
};

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

const fmtDateTime = (dateStr: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));

export default function CrmPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crm/customers")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setCustomers(data))
      .catch(() => {
        setCustomers([]);
        toast({ title: "Erro", description: "Falha ao carregar clientes.", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "nome" ? "asc" : "desc");
    }
  };

  const filtered = useMemo(() => {
    let list = [...customers];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.doc.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((c) => c.healthStatus === statusFilter);
    }

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "nome":
          return dir * a.name.localeCompare(b.name, "pt-BR");
        case "status":
          return dir * ((healthOrder[a.healthStatus] ?? 9) - (healthOrder[b.healthStatus] ?? 9));
        case "valorAberto":
          return dir * (a.totalAberto - b.totalAberto);
        case "totalVencido":
          return dir * (a.totalVencido - b.totalVencido);
        case "qtdTarefasAbertas":
          return dir * (a.qtdTarefasAbertas - b.qtdTarefasAbertas);
        case "ultimaInteracao": {
          const aDate = a.ultimaInteracao ?? "";
          const bDate = b.ultimaInteracao ?? "";
          return dir * aDate.localeCompare(bDate);
        }
        default:
          return 0;
      }
    });

    return list;
  }, [search, statusFilter, sortKey, sortDir, customers]);

  // Reset page when filters change
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safeCurrentPage = Math.min(page, Math.max(1, totalPages));
  const paginatedClients = filtered.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  // Stats
  const totalClientes = customers.length;
  const criticos = customers.filter((c) => c.healthStatus === "Crítico").length;
  const totalValorVencido = customers.reduce((s, c) => s + c.totalVencido, 0);
  const totalTarefasAbertas = customers.reduce((s, c) => s + c.qtdTarefasAbertas, 0);

  const hasActiveFilters = search !== "" || statusFilter !== "all";

  // Map for export compatibility
  const exportData = filtered.map((c) => ({
    nome: c.name,
    razaoSocial: c.doc,
    cnpj: c.doc,
    status: c.healthStatus,
    valorAberto: c.totalAberto,
    totalVencido: c.totalVencido,
    qtdTarefasAbertas: c.qtdTarefasAbertas,
    ultimaInteracao: c.ultimaInteracao,
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <KpiSkeleton count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-48 rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <TableSkeleton rows={8} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        subtitle={`${totalClientes} clientes no portfólio`}
        secondaryActions={[
          {
            label: "Exportar",
            icon: <Download className="h-4 w-4" />,
            onClick: () => exportCrmClientsToXlsx(exportData),
          },
        ]}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-4 w-4 text-gray-400" />}
          label="Total Clientes"
          value={String(totalClientes)}
          onClick={() => { setStatusFilter("all"); setPage(1); }}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-gray-400" />}
          label="Críticos"
          value={String(criticos)}
          danger={criticos > 0}
          onClick={() => { setStatusFilter("Crítico"); setPage(1); }}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-gray-400" />}
          label="Valor Total Vencido"
          value={fmtBRL(totalValorVencido)}
          danger={totalValorVencido > 0}
          onClick={() => { setStatusFilter("Exige Atenção"); setPage(1); }}
        />
        <StatCard
          icon={<ListTodo className="h-4 w-4 text-gray-400" />}
          label="Tarefas Abertas"
          value={String(totalTarefasAbertas)}
          onClick={() => router.push("/crm/tarefas")}
        />
      </div>

      {/* Dashboard */}
      <CrmDashboard customers={customers} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome, documento ou e-mail…"
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus-visible:ring-2 focus-visible:ring-secondary/30 focus-visible:border-secondary transition-colors"
          />
        </div>
        <FilterPillGroup
          options={[
            { key: "all", label: "Todos", count: customers.length },
            { key: "Saudável", label: "Saudável", count: customers.filter((c) => c.healthStatus === "Saudável").length },
            { key: "Controlado", label: "Controlado", count: customers.filter((c) => c.healthStatus === "Controlado").length },
            { key: "Exige Atenção", label: "Exige Atenção", count: customers.filter((c) => c.healthStatus === "Exige Atenção").length },
            { key: "Crítico", label: "Crítico", count: customers.filter((c) => c.healthStatus === "Crítico").length },
          ]}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
        />
      </div>

      {/* Table or Empty State */}
      {filtered.length === 0 ? (
        <FilterEmptyState
          message="Nenhum cliente encontrado para os filtros selecionados."
          suggestion="Tente ajustar os filtros."
          onClear={hasActiveFilters ? () => { setSearch(""); setStatusFilter("all"); } : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  {([
                    { key: "nome" as SortKey, label: "Cliente", align: "text-left", px: "px-5" },
                    { key: "status" as SortKey, label: "Saúde", align: "text-left", px: "px-4" },
                    { key: "valorAberto" as SortKey, label: "Dívida Total", align: "text-right", px: "px-4" },
                    { key: "totalVencido" as SortKey, label: "Vencido", align: "text-right", px: "px-4" },
                    { key: "qtdTarefasAbertas" as SortKey, label: "Tarefas", align: "text-center", px: "px-4" },
                    { key: "ultimaInteracao" as SortKey, label: "Última Interação", align: "text-left", px: "px-4" },
                  ]).map((col) => {
                    const isActive = sortKey === col.key;
                    const SortIcon = isActive
                      ? sortDir === "asc" ? ArrowUp : ArrowDown
                      : ArrowUpDown;
                    return (
                      <th
                        key={col.key}
                        className={cn(
                          col.px, "py-3 font-medium text-xs uppercase tracking-wide cursor-pointer select-none hover:text-gray-600 transition-colors",
                          col.align,
                          isActive ? "text-gray-600" : "text-gray-400"
                        )}
                        onClick={() => toggleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          <SortIcon className="h-3 w-3" />
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((c) => {
                  const sc = statusColors[c.healthStatus] ?? statusColors.Saudável;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/crm/${c.id}`)}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.doc}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                            sc.bg,
                            sc.text
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                          {c.healthStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {fmtBRL(c.totalAberto)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={c.totalVencido > 0 ? "text-red-600 font-medium" : "text-gray-400"}>
                          {c.totalVencido > 0 ? fmtBRL(c.totalVencido) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.qtdTarefasAbertas > 0 ? (
                          <span className="inline-flex items-center justify-center h-6 min-w-[24px] rounded-full bg-blue-50 text-blue-700 text-xs font-medium px-1.5">
                            {c.qtdTarefasAbertas}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {c.ultimaInteracao ? fmtDateTime(c.ultimaInteracao) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
