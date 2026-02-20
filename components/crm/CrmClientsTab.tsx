"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { MetricCard } from "@/components/ui/metric-card";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/use-toast";
import { exportCrmClientsToXlsx } from "@/lib/crm-export";
import type { CrmCustomer } from "@/lib/types/crm";
import { KpiSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { SearchBar } from "@/components/ui/search-bar";
import { AlertTriangle, DollarSign, Clock, PhoneMissed, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

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

interface CrmClientsTabProps {
  onSwitchToTarefas?: () => void;
}

export function CrmClientsTab({ onSwitchToTarefas }: CrmClientsTabProps) {
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
      if (statusFilter === "sem_contato_7d") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        list = list.filter(
          (c) => !c.ultimaInteracao || new Date(c.ultimaInteracao) < sevenDaysAgo
        );
      } else {
        list = list.filter((c) => c.healthStatus === statusFilter);
      }
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safeCurrentPage = Math.min(page, Math.max(1, totalPages));
  const paginatedClients = filtered.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  // ── Actionable KPIs ──
  const criticos = customers.filter((c) => c.healthStatus === "Crítico").length;
  const exigeAtencao = customers.filter((c) => c.healthStatus === "Exige Atenção").length;
  const totalValorVencido = customers.reduce((s, c) => s + c.totalVencido, 0);
  const clientesComVencido = customers.filter((c) => c.totalVencido > 0).length;
  const totalTarefasAbertas = customers.reduce((s, c) => s + c.qtdTarefasAbertas, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const semContato7d = customers.filter(
    (c) => !c.ultimaInteracao || new Date(c.ultimaInteracao) < sevenDaysAgo
  ).length;

  const hasActiveFilters = search !== "" || statusFilter !== "all";

  const handleExport = () => {
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
    exportCrmClientsToXlsx(exportData);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <KpiSkeleton count={4} />
        <TableSkeleton rows={8} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actionable KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Clientes Críticos"
          value={String(criticos)}
          subtitle={`${exigeAtencao} exigem atenção · de ${customers.length}`}
          variant={criticos > 0 ? "danger" : "default"}
          onClick={() => { setStatusFilter("Crítico"); setPage(1); }}
          className="animate-in stagger-1"
        />
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          title="Valor Vencido"
          value={fmtBRL(totalValorVencido)}
          subtitle={`${clientesComVencido} clientes inadimplentes`}
          variant={totalValorVencido > 0 ? "danger" : "default"}
          onClick={() => { setStatusFilter("Exige Atenção"); setPage(1); }}
          className="animate-in stagger-2"
        />
        <MetricCard
          icon={<Clock className="h-4 w-4" />}
          title="Tarefas Atrasadas"
          value={String(totalTarefasAbertas)}
          subtitle="pendentes + em andamento"
          variant={totalTarefasAbertas > 0 ? "danger" : "default"}
          onClick={onSwitchToTarefas}
          className="animate-in stagger-3"
        />
        <MetricCard
          icon={<PhoneMissed className="h-4 w-4" />}
          title="Sem Contato 7d+"
          value={String(semContato7d)}
          subtitle="sem interação na última semana"
          variant={semContato7d > 0 ? "danger" : "default"}
          onClick={() => { setStatusFilter("sem_contato_7d"); setPage(1); }}
          className="animate-in stagger-4"
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <SearchBar
          value={search}
          onValueChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Buscar por nome, cidade, bairro, responsável ou CNPJ…"
          wrapperClassName="max-w-sm"
        />
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
                    { key: "nome" as SortKey, label: "Cliente", align: "text-left", px: "px-4" },
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
                      onClick={() => router.push(`/clientes/${c.id}`)}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
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
