"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { FranqueadoraCard } from "@/components/franqueadora-card";
import { ImportDialog } from "@/components/franqueados/ImportDialog";
import { franqueadosDummy, type Franqueado } from "@/lib/data/clientes-dummy";
import { exportFranqueadosToXlsx } from "@/lib/franqueados-import-export";
import { MapPin, Upload, Download, AlertTriangle, X } from "lucide-react";
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
  const [franqueados, setFranqueados] =
    useState<Franqueado[]>(franqueadosDummy);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");
  const [importOpen, setImportOpen] = useState(false);
  const [dupBannerDismissed, setDupBannerDismissed] = useState(false);

  const counts = useMemo(() => {
    return {
      Todos: franqueados.length,
      Aberta: franqueados.filter((c) => c.statusLoja === "Aberta").length,
      Fechada: franqueados.filter((c) => c.statusLoja === "Fechada").length,
      Vendida: franqueados.filter((c) => c.statusLoja === "Vendida").length,
    };
  }, [franqueados]);

  const filtered = useMemo(() => {
    if (statusFilter === "Todos") return franqueados;
    return franqueados.filter((c) => c.statusLoja === statusFilter);
  }, [statusFilter, franqueados]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Franqueados"
        subtitle={`${counts.Todos} franqueados cadastrados`}
        primaryAction={{ label: "Novo Franqueado", href: "/clientes/novo" }}
        secondaryActions={[
          {
            label: "Importar",
            icon: <Upload className="h-4 w-4" />,
            onClick: () => setImportOpen(true),
          },
          {
            label: "Exportar",
            icon: <Download className="h-4 w-4" />,
            onClick: () => exportFranqueadosToXlsx(filtered),
          },
        ]}
      />

      <FranqueadoraCard />

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
        {/* Tab bar + Search */}
        <div className="border-b border-gray-100">
          <div className="flex items-center justify-between px-4">
            {/* Status tabs */}
            <nav className="flex gap-0" aria-label="Filtrar por status">
              {tabs.map((tab) => {
                const isActive = statusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={cn(
                      "relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "text-gray-900"
                        : "text-gray-400 hover:text-gray-600"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {tab.label}
                    <span
                      className={cn(
                        "ml-1.5 text-xs tabular-nums",
                        isActive ? "text-gray-500" : "text-gray-300"
                      )}
                    >
                      {counts[tab.value]}
                    </span>
                    {isActive && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gray-900 rounded-full" />
                    )}
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
                  {filtered.map((c) => {
                    const config = statusLojaConfig[c.statusLoja];
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
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
                              {c.responsavel}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {c.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <MapPin className="h-3.5 w-3.5 text-gray-300 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              {c.cidade}/{c.estado}
                            </span>
                          </div>
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
                          {formatDate(c.dataAbertura)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                {filtered.length} de {counts.Todos} franqueados
              </span>
              {statusFilter !== "Todos" && (
                <button
                  onClick={() => setStatusFilter("Todos")}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </>
        )}
      </div>

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
