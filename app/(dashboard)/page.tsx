"use client";

import { useState } from "react";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiTile } from "@/components/ui/kpi-tile";
import { HeatmapTile } from "@/components/ui/heatmap-tile";
import {
  ChartCard,
  StripeRevenueChart,
  StripePaymentMethodsChart,
  StripeChargesStatusChart,
  SafraCurveChart,
} from "@/components/charts/stripe-charts";
import { cobrancasDummy, getCobrancasStats } from "@/lib/data/cobrancas-dummy";
import { ciclosHistorico } from "@/lib/data/apuracao-historico-dummy";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  FileText,
  Sparkles,
} from "lucide-react";

// ── Competências derivadas dos ciclos de apuração ──

const competencias = ciclosHistorico.map((c) => ({
  label: c.competenciaShort,
  value: c.competencia,
}));

// ── Dados dos gráficos (derivados das cobranças reais) ──

const ciclosChronological = [...ciclosHistorico].reverse();

const safraColors = ["#9ca3af", "#8b5cf6", "#10b981", "#F85B00", "#85ace6"];

function buildChartData() {
  const revenueData = ciclosChronological.map((ciclo) => {
    const cobsDoMes = cobrancasDummy.filter((c) => c.competencia === ciclo.competencia);
    const totalEmitido = cobsDoMes.reduce((s, c) => s + c.valorOriginal, 0);
    const totalRecebido = cobsDoMes.reduce((s, c) => s + c.valorPago, 0);
    return {
      month: ciclo.competenciaShort,
      revenue: Math.round(totalRecebido / 100),
      projected: Math.round(totalEmitido / 100),
    };
  });

  const chargesStatusData = ciclosChronological.map((ciclo) => {
    const cobsDoMes = cobrancasDummy.filter((c) => c.competencia === ciclo.competencia);
    return {
      month: ciclo.competenciaShort,
      pagas: cobsDoMes.filter((c) => c.status === "Paga").length,
      pendentes: cobsDoMes.filter((c) => c.status === "Aberta").length,
      vencidas: cobsDoMes.filter((c) => c.status === "Vencida").length,
    };
  });

  const paymentMethodsData = ciclosChronological.map((ciclo) => {
    const cobsDoMes = cobrancasDummy.filter((c) => c.competencia === ciclo.competencia);
    return {
      month: ciclo.competenciaShort,
      boleto: Math.round(
        cobsDoMes.filter((c) => c.formaPagamento === "Boleto").reduce((s, c) => s + c.valorOriginal, 0) / 100
      ),
      pix: Math.round(
        cobsDoMes.filter((c) => c.formaPagamento === "Pix").reduce((s, c) => s + c.valorOriginal, 0) / 100
      ),
      cartao: Math.round(
        cobsDoMes.filter((c) => c.formaPagamento === "Cartão").reduce((s, c) => s + c.valorOriginal, 0) / 100
      ),
    };
  });

  return { revenueData, chargesStatusData, paymentMethodsData };
}

// ── Curva de Recebimento por Safra ──

function buildSafraData() {
  const hoje = new Date("2026-02-07");
  const dayIntervals = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];

  // Safras: cada competência é uma safra (mais antiga → mais nova)
  const safras = ciclosChronological.map((ciclo, idx) => ({
    key: ciclo.competenciaShort.replace("/", ""),
    label: ciclo.competenciaShort,
    color: safraColors[idx % safraColors.length],
    emissionDate: new Date(ciclo.dataApuracao + "T12:00:00"),
    competencia: ciclo.competencia,
  }));

  const data = dayIntervals.map((d) => {
    const point: Record<string, number | string | undefined> = { day: `D+${d}` };

    for (const safra of safras) {
      const cutoff = new Date(safra.emissionDate);
      cutoff.setDate(cutoff.getDate() + d);

      // Se a data de corte é no futuro, esta safra ainda não tem dados para este ponto
      if (cutoff > hoje) {
        point[safra.key] = undefined;
        continue;
      }

      const cobsDoMes = cobrancasDummy.filter((c) => c.competencia === safra.competencia);
      const totalEmitido = cobsDoMes.reduce((s, c) => s + c.valorOriginal, 0);

      if (totalEmitido === 0) {
        point[safra.key] = 0;
        continue;
      }

      const cutoffISO = cutoff.toISOString().split("T")[0];
      const totalColetado = cobsDoMes
        .filter((c) => c.dataPagamento && c.dataPagamento <= cutoffISO)
        .reduce((s, c) => s + c.valorPago, 0);

      point[safra.key] = Math.round((totalColetado / totalEmitido) * 100);
    }

    return point;
  });

  return {
    data,
    safras: safras.map((s) => ({ key: s.key, label: s.label, color: s.color })),
  };
}

const chartData = buildChartData();
const safraData = buildSafraData();

// ── Component ──

export default function DashboardPage() {
  const [selectedCompetencia, setSelectedCompetencia] = useState(competencias[0].value);

  const selectedLabel = competencias.find((c) => c.value === selectedCompetencia)?.label || "";
  const periodLabel = `Competência: ${selectedLabel}`;

  // ── KPIs do mês selecionado ──
  const cobrancasDoMes = cobrancasDummy.filter((c) => c.competencia === selectedCompetencia);
  const stats = getCobrancasStats(cobrancasDoMes);

  const inadRate = stats.totalEmitido > 0
    ? ((stats.totalAberto / stats.totalEmitido) * 100).toFixed(1)
    : "0.0";

  // ── Trend vs. competência anterior ──
  const currentIdx = competencias.findIndex((c) => c.value === selectedCompetencia);
  const prevComp = currentIdx < competencias.length - 1 ? competencias[currentIdx + 1] : null;
  let trendEmitido = 0;
  let trendRecebido = 0;
  let trendInad = 0;
  let trendPendentes = 0;

  if (prevComp) {
    const prevCobs = cobrancasDummy.filter((c) => c.competencia === prevComp.value);
    const prevStats = getCobrancasStats(prevCobs);
    if (prevStats.totalEmitido > 0) {
      trendEmitido = Math.round(((stats.totalEmitido - prevStats.totalEmitido) / prevStats.totalEmitido) * 100);
      const prevInad = (prevStats.totalAberto / prevStats.totalEmitido) * 100;
      trendInad = Math.round((Number(inadRate) - prevInad) * 10) / 10;
    }
    if (prevStats.totalPago > 0) {
      trendRecebido = Math.round(((stats.totalPago - prevStats.totalPago) / prevStats.totalPago) * 100);
    }
    const prevPendentes = prevStats.byStatus.aberta + prevStats.byStatus.vencida;
    const currPendentes = stats.byStatus.aberta + stats.byStatus.vencida;
    if (prevPendentes > 0) {
      trendPendentes = Math.round(((currPendentes - prevPendentes) / prevPendentes) * 100);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Dashboard"
        subtitle="Visão consolidada de cobranças e recebimentos"
        period={periodLabel}
        primaryAction={{ label: "Nova Cobrança", href: "/cobrancas/nova" }}
        secondaryActions={[
          { label: "Insights", href: "/insights", icon: <Sparkles className="h-4 w-4" /> },
        ]}
      />

      {/* ── Filtros de competência ── */}
      <FilterPillGroup
        options={competencias.map((c) => ({ key: c.value, label: c.label }))}
        value={selectedCompetencia}
        onChange={setSelectedCompetencia}
      />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          title="Total Emitido"
          value={`R$ ${(stats.totalEmitido / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle={`${stats.total} cobranças · ${selectedLabel}`}
          trend={{ value: Math.abs(trendEmitido), direction: trendEmitido >= 0 ? "up" : "down" }}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiTile
          title="Total Recebido"
          value={`R$ ${(stats.totalPago / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle={`${stats.byStatus.paga} pagas · ${selectedLabel}`}
          trend={{ value: Math.abs(trendRecebido), direction: trendRecebido >= 0 ? "up" : "down" }}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiTile
          title="Taxa de Inadimplência"
          value={`${inadRate}%`}
          subtitle={`${stats.byStatus.vencida} vencidas · ${selectedLabel}`}
          tooltip="Percentual do valor emitido que está vencido e não foi pago"
          trend={{ value: Math.abs(trendInad), direction: trendInad <= 0 ? "down" : "up" }}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={Number(inadRate) > 15 ? "danger" : "default"}
        />
        <KpiTile
          title="Cobranças Pendentes"
          value={String(stats.byStatus.aberta + stats.byStatus.vencida)}
          subtitle={`De ${stats.total} emitidas · ${selectedLabel}`}
          trend={{ value: Math.abs(trendPendentes), direction: trendPendentes <= 0 ? "down" : "up" }}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Recebido vs. Emitido" subtitle="Últimos 5 meses">
          <StripeRevenueChart data={chartData.revenueData} />
        </ChartCard>
        <ChartCard title="Curva de Recebimento por Safra" subtitle="Evolução cumulativa por competência">
          <SafraCurveChart data={safraData.data} safras={safraData.safras} />
        </ChartCard>
        <ChartCard title="Status das Cobranças" subtitle="Evolução mensal">
          <StripeChargesStatusChart data={chartData.chargesStatusData} />
        </ChartCard>
        <ChartCard title="Formas de Pagamento" subtitle="Distribuição por mês">
          <StripePaymentMethodsChart data={chartData.paymentMethodsData} />
        </ChartCard>
      </div>

      {/* ── Heatmap ── */}
      <HeatmapTile />
    </div>
  );
}
