"use client";

import { useMemo, useState, useEffect } from "react";
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
import { MapPin, Upload, Download, AlertTriangle, X, Search, Users } from "lucide-react";
import { cn } from "@/lib/cn";

type StatusFilter = "Todos" | "Aberta" | "Fechada" | "Vendida";

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

export default function ClientesPage() {
  const [franqueados, setFranqueados] = useState<Franqueado[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [dupBannerDismissed, setDupBannerDismissed] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFranqueados(data);
      })
      .finally(() => setLoading(false));
  }, []);

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
      <div className="space-y-5">
        <PageHeader title="Cadastro" />
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Cadastro" />

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
            <span className="ml-2 text-sm font-normal text-gray-400">{counts.Todos} cadastrados</span>
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
          secondaryActionHref="#"
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
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, cidade, bairro, responsável ou CNPJ…"
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus-visible:outline-none focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary/30 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
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
                        <span className="ml-1.5 text-xs text-gray-400 tabular-nums">
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
                  <table className="w-full text-sm" aria-label="Lista de franqueados">
                    <thead>
                      <tr className="border-b border-gray-100 text-left">
                        <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                          Franqueado
                        </th>
                        <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                          Responsável
                        </th>
                        <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                          Localização
                        </th>
                        <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                          Status
                        </th>
                        <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide text-right">
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
                            <td className="px-5 py-3.5">
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
                                  <p className="text-xs text-gray-400 truncate">
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
                            <td className="px-4 py-3.5">
                              <div className="min-w-0">
                                <p className="text-sm text-gray-900 truncate">
                                  {c.responsavel || "—"}
                                </p>
                                <p className="text-xs text-gray-400 truncate">
                                  {c.email}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
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
                            <td className="px-4 py-3.5">
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
                            <td className="px-4 py-3.5 text-sm text-gray-500 tabular-nums text-right">
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
