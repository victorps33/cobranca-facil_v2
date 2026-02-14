"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/ui/metric-card";
import { DataEmptyState } from "@/components/layout/DataEmptyState";
import { ApuracaoWizard } from "@/components/apuracao/ApuracaoWizard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import {
  DollarSign,
  CheckCircle2,
  Users,
  Calendar,
  FileText,
  Download,
  ChevronDown,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import * as XLSX from "xlsx";
import type { ApuracaoCiclo } from "@/lib/types";

// ── Local helpers ──

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}

function getCompetenciasDisponiveis(): { label: string; value: string }[] {
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const hoje = new Date();
  const competencias: { label: string; value: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const label = `${meses[d.getMonth()]}/${d.getFullYear()}`;
    competencias.push({ label, value: label });
  }
  return competencias;
}

// ── Component ──

type Tab = "novo" | "historico";

export default function ApuracaoPage() {
  const [ciclosHistorico, setCiclosHistorico] = useState<ApuracaoCiclo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("novo");
  const [expandedCiclo, setExpandedCiclo] = useState<string | null>(null);

  useEffect(() => {
    // For now, there's no dedicated apuracao API — show empty historico
    // In the future, this will fetch from /api/apuracao
    setLoading(false);
  }, []);

  const todasCompetencias = getCompetenciasDisponiveis();
  const competenciasUsadas = new Set(ciclosHistorico.map((c) => c.competencia));
  const competencias = todasCompetencias.filter((c) => !competenciasUsadas.has(c.value));

  const [competenciaSelecionada, setCompetenciaSelecionada] = useState("");

  // Set initial competência when competencias are available
  useEffect(() => {
    if (competencias.length > 0 && !competenciaSelecionada) {
      setCompetenciaSelecionada(competencias[0].value);
    }
  }, [competencias, competenciaSelecionada]);

  // ── Histórico KPIs ──
  const totalApurado = ciclosHistorico.reduce((s, c) => s + c.totalCobrado, 0);
  const totalCiclos = ciclosHistorico.length;
  const totalFranqueados = ciclosHistorico.reduce((s, c) => s + c.franqueados, 0);
  const mediaFranqueado = totalFranqueados > 0 ? Math.round(totalApurado / totalFranqueados) : 0;

  // ── Export helper ──
  function fmtBRL(cents: number): number {
    return Number((cents / 100).toFixed(2));
  }

  function exportCiclo(ciclo: ApuracaoCiclo) {
    const rows = ciclo.detalhes.map((d) => ({
      "Franqueado": d.franqueado,
      "PDV (R$)": fmtBRL(d.pdv),
      "iFood (R$)": fmtBRL(d.ifood),
      "Rappi (R$)": fmtBRL(d.rappi),
      "Faturamento (R$)": fmtBRL(d.faturamento),
      "Royalties (R$)": fmtBRL(d.royalties),
      "Marketing (R$)": fmtBRL(d.marketing),
      "Total Cobrado (R$)": fmtBRL(d.totalCobrado),
      "NF Emitida": d.nfEmitida ? "Sim" : "Não",
    }));

    rows.push({
      "Franqueado": "TOTAL",
      "PDV (R$)": fmtBRL(ciclo.detalhes.reduce((s, d) => s + d.pdv, 0)),
      "iFood (R$)": fmtBRL(ciclo.detalhes.reduce((s, d) => s + d.ifood, 0)),
      "Rappi (R$)": fmtBRL(ciclo.detalhes.reduce((s, d) => s + d.rappi, 0)),
      "Faturamento (R$)": fmtBRL(ciclo.faturamentoTotal),
      "Royalties (R$)": fmtBRL(ciclo.royaltyTotal),
      "Marketing (R$)": fmtBRL(ciclo.marketingTotal),
      "Total Cobrado (R$)": fmtBRL(ciclo.totalCobrado),
      "NF Emitida": `${ciclo.nfsEmitidas} NFs`,
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Apuração");
    XLSX.writeFile(wb, `apuracao_${ciclo.competencia.replace("/", "-")}.xlsx`);
  }

  const competenciaLabel = competencias.find((c) => c.value === competenciaSelecionada)?.label ?? "";

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Apuração" />
        <Skeleton className="h-10 w-48 rounded-xl" />
        <TableSkeleton rows={5} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <PageHeader
        title="Apuração"
        period={competenciaLabel ? `Competência: ${competenciaLabel}` : undefined}
      />

      {/* Prazo badge */}
      {activeTab === "novo" && competenciaSelecionada && (() => {
        const [mes, ano] = competenciaSelecionada.split("/");
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const mesIdx = meses.indexOf(mes);
        if (mesIdx === -1) return null;
        const prazo = new Date(parseInt(ano), mesIdx + 1, 10);
        const hoje = new Date();
        const diasRestantes = Math.ceil((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        const prazoStr = prazo.toLocaleDateString("pt-BR");
        const isAtrasado = diasRestantes < 0;
        const isUrgente = diasRestantes >= 0 && diasRestantes <= 3;
        return (
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium",
            isAtrasado
              ? "bg-red-50 text-red-700 border border-red-200"
              : isUrgente
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          )}>
            <Calendar className="h-4 w-4" />
            {isAtrasado
              ? `Prazo expirado (era ${prazoStr})`
              : diasRestantes === 0
              ? `Último dia para apuração (${prazoStr})`
              : `A realizar até ${prazoStr} (${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""})`
            }
          </div>
        );
      })()}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="novo">Novo Ciclo</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ════════════════════════════════════════════ */}
      {/* TAB: NOVO CICLO                             */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === "novo" && (
        <div className="space-y-6">
          {/* Competência pills */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Competência</p>
            {competencias.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {competencias.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCompetenciaSelecionada(c.value)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                      c.value === competenciaSelecionada
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Todas as competências recentes já possuem ciclo concluído.
              </p>
            )}
          </div>

          {/* Wizard — key forces remount on competência change */}
          {competenciaSelecionada && (
            <ApuracaoWizard
              key={competenciaSelecionada}
              competencia={competenciaSelecionada}
            />
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* TAB: HISTÓRICO                              */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === "historico" && (
        <div className="space-y-6">
          {ciclosHistorico.length === 0 ? (
            <DataEmptyState
              title="Nenhum ciclo de apuração registrado"
              description="Realize seu primeiro ciclo de apuração na aba 'Novo Ciclo' para ver o histórico aqui."
              icon={<ClipboardList className="h-6 w-6 text-gray-400" />}
            />
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricCard
                  icon={<DollarSign className="h-4 w-4" />}
                  title="Total apurado"
                  value={formatCurrency(totalApurado)}
                  subtitle={`${totalCiclos} ciclos concluídos`}
                  className="animate-in stagger-1"
                />
                <MetricCard
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title="Ciclos concluídos"
                  value={String(totalCiclos)}
                  subtitle="Histórico completo"
                  className="animate-in stagger-2"
                />
                <MetricCard
                  icon={<Users className="h-4 w-4" />}
                  title="Média / franqueado"
                  value={formatCurrency(mediaFranqueado)}
                  subtitle="por ciclo"
                  className="animate-in stagger-3"
                />
              </div>

              {/* Tabela de ciclos */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-medium text-gray-900">Ciclos anteriores</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" aria-label="Histórico de ciclos de apuração">
                    <thead>
                      <tr className="border-b border-gray-100 text-left">
                        <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">Competência</th>
                        <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">Data</th>
                        <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide text-right">Franqueados</th>
                        <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide text-right">Faturamento</th>
                        <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide text-right">Total cobrado</th>
                        <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide text-right">NFs</th>
                        <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">Status</th>
                        <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide text-center">Exportar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ciclosHistorico.map((ciclo) => {
                        const isExpanded = expandedCiclo === ciclo.id;
                        return (
                          <React.Fragment key={ciclo.id}>
                            <tr
                              onClick={() => setExpandedCiclo(isExpanded ? null : ciclo.id)}
                              className={cn(
                                "border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer",
                                isExpanded && "bg-gray-50/50"
                              )}
                            >
                              <td className="px-5 py-3 font-medium text-gray-900">
                                <span className="inline-flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                                  )}
                                  {ciclo.competencia}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-gray-600">
                                <span className="inline-flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                  {formatDate(ciclo.dataApuracao)}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right text-gray-600 tabular-nums">{ciclo.franqueados}</td>
                              <td className="px-5 py-3 text-right text-gray-600 tabular-nums">{formatCurrency(ciclo.faturamentoTotal)}</td>
                              <td className="px-5 py-3 text-right font-medium text-gray-900 tabular-nums">{formatCurrency(ciclo.totalCobrado)}</td>
                              <td className="px-5 py-3 text-right text-gray-600 tabular-nums">
                                <span className="inline-flex items-center gap-1">
                                  <FileText className="h-3.5 w-3.5 text-gray-400" />
                                  {ciclo.nfsEmitidas}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                                  Concluído
                                </span>
                              </td>
                              <td className="px-5 py-3 text-center">
                                <button
                                  onClick={(e) => { e.stopPropagation(); exportCiclo(ciclo); }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-primary hover:bg-orange-50 rounded-full transition-colors"
                                  title={`Exportar ${ciclo.competencia}`}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  .xlsx
                                </button>
                              </td>
                            </tr>

                            {/* Detalhes expandidos por loja */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={8} className="p-0">
                                  <div className="bg-gray-50/80 border-b border-gray-100">
                                    <div className="px-8 py-4">
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                        Detalhamento por loja — {ciclo.competencia}
                                      </p>
                                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="border-b border-gray-100 text-left">
                                              <th className="px-4 py-2.5 font-medium text-gray-500">Franqueado</th>
                                              <th className="px-4 py-2.5 font-medium text-gray-500 text-right">PDV</th>
                                              <th className="px-4 py-2.5 font-medium text-gray-500 text-right">iFood</th>
                                              <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Rappi</th>
                                              <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Faturamento</th>
                                              <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Royalties</th>
                                              <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Marketing</th>
                                              <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Total Cobrado</th>
                                              <th className="px-4 py-2.5 font-medium text-gray-500 text-center">NF</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {ciclo.detalhes.map((d, idx) => (
                                              <tr
                                                key={idx}
                                                className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                                              >
                                                <td className="px-4 py-2.5 font-medium text-gray-900">{d.franqueado}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{formatCurrency(d.pdv)}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{formatCurrency(d.ifood)}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{formatCurrency(d.rappi)}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{formatCurrency(d.faturamento)}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{formatCurrency(d.royalties)}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{formatCurrency(d.marketing)}</td>
                                                <td className="px-4 py-2.5 text-right font-medium text-gray-900 tabular-nums">{formatCurrency(d.totalCobrado)}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                  {d.nfEmitida ? (
                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">Sim</span>
                                                  ) : (
                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">Não</span>
                                                  )}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                          <tfoot>
                                            <tr className="border-t border-gray-200 bg-gray-50/50">
                                              <td className="px-4 py-2.5 font-semibold text-gray-900">Total</td>
                                              <td className="px-4 py-2.5 text-right font-medium text-gray-700 tabular-nums">
                                                {formatCurrency(ciclo.detalhes.reduce((s, d) => s + d.pdv, 0))}
                                              </td>
                                              <td className="px-4 py-2.5 text-right font-medium text-gray-700 tabular-nums">
                                                {formatCurrency(ciclo.detalhes.reduce((s, d) => s + d.ifood, 0))}
                                              </td>
                                              <td className="px-4 py-2.5 text-right font-medium text-gray-700 tabular-nums">
                                                {formatCurrency(ciclo.detalhes.reduce((s, d) => s + d.rappi, 0))}
                                              </td>
                                              <td className="px-4 py-2.5 text-right font-medium text-gray-700 tabular-nums">
                                                {formatCurrency(ciclo.faturamentoTotal)}
                                              </td>
                                              <td className="px-4 py-2.5 text-right font-medium text-gray-700 tabular-nums">
                                                {formatCurrency(ciclo.royaltyTotal)}
                                              </td>
                                              <td className="px-4 py-2.5 text-right font-medium text-gray-700 tabular-nums">
                                                {formatCurrency(ciclo.marketingTotal)}
                                              </td>
                                              <td className="px-4 py-2.5 text-right font-bold text-gray-900 tabular-nums">
                                                {formatCurrency(ciclo.totalCobrado)}
                                              </td>
                                              <td className="px-4 py-2.5 text-center text-gray-600 font-medium">
                                                {ciclo.nfsEmitidas}
                                              </td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                  {ciclosHistorico.length} ciclos
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
