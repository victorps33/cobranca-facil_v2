"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { StripeKpiCard } from "@/components/ui/stripe-kpi-card";
import { AIInsightsWidget } from "@/components/ui/ai-insights-widget";
import { DunningTimelineCompact } from "@/components/ui/dunning-timeline";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonDashboard } from "@/components/ui/skeleton-loader";
import { KpiTile } from "@/components/ui/kpi-tile";
import { HeatmapTile } from "@/components/ui/heatmap-tile";
import {
  ChartCard,
  StripeRevenueChart,
  StripePaymentMethodsChart,
  StripeChargesStatusChart,
  StripeCollectionRateChart,
  ChartLegend,
} from "@/components/charts/stripe-charts";
import {
  DollarSign,
  FileText,
  Users,
  TrendingUp,
  AlertTriangle,
  Play,
  FastForward,
  RotateCcw,
  Loader2,
  Sparkles,
} from "lucide-react";

function getCurrentPeriodLabel(): string {
  const now = new Date();
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${months[now.getMonth()]}/${String(now.getFullYear()).slice(-2)}`;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [demoDate, setDemoDate] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const periodLabel = `Competência: ${getCurrentPeriodLabel()}`;

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/app-state");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setDemoDate(json.demoDate);
      }
    } catch {
      // use dummy fallback
      setData({
        stats: { total: 25, pending: 8, paid: 14, overdue: 3, totalAmount: 157500, paidAmount: 98200 },
        charges: [],
        dunningRule: null,
      });
    }
    setLoading(false);
  }

  async function runDunning() {
    setIsRunning(true);
    try {
      const res = await fetch("/api/dunning/run", { method: "POST" });
      if (res.ok) {
        toast({ title: "Régua executada", description: "Notificações geradas com sucesso." });
        fetchData();
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao executar a régua.", variant: "destructive" });
    }
    setIsRunning(false);
  }

  async function simulateDays(days: number) {
    setIsRunning(true);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      if (res.ok) {
        toast({ title: `+${days} dias simulados`, description: "Dados atualizados." });
        fetchData();
      }
    } catch {
      toast({ title: "Erro", description: "Falha na simulação.", variant: "destructive" });
    }
    setIsRunning(false);
  }

  async function resetDemo() {
    try {
      const res = await fetch("/api/simulate/reset", { method: "POST" });
      if (res.ok) {
        toast({ title: "Data resetada", description: "Voltou para a data real." });
        fetchData();
      }
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  }

  if (loading) return <SkeletonDashboard />;

  const stats = data?.stats || { total: 0, pending: 0, paid: 0, overdue: 0, totalAmount: 0, paidAmount: 0 };
  const inadRate = stats.totalAmount > 0
    ? ((stats.totalAmount - stats.paidAmount) / stats.totalAmount * 100).toFixed(1)
    : "0.0";

  // ── Dados dummy dos gráficos (6 meses, valores coerentes com KPIs) ──
  const revenueData = [
    { month: "Set/24", revenue: 118000, projected: 115000 },
    { month: "Out/24", revenue: 125000, projected: 120000 },
    { month: "Nov/24", revenue: 131000, projected: 128000 },
    { month: "Dez/24", revenue: 142000, projected: 135000 },
    { month: "Jan/25", revenue: 138000, projected: 140000 },
    { month: "Fev/25", revenue: 157500, projected: 145000 },
  ];

  const paymentMethodsData = [
    { month: "Set/24", boleto: 68000, pix: 38000, cartao: 12000 },
    { month: "Out/24", boleto: 72000, pix: 40000, cartao: 13000 },
    { month: "Nov/24", boleto: 74000, pix: 43000, cartao: 14000 },
    { month: "Dez/24", boleto: 80000, pix: 47000, cartao: 15000 },
    { month: "Jan/25", boleto: 78000, pix: 45000, cartao: 15000 },
    { month: "Fev/25", boleto: 88000, pix: 52000, cartao: 17500 },
  ];

  const chargesStatusData = [
    { month: "Set/24", pagas: 18, pendentes: 4, vencidas: 2 },
    { month: "Out/24", pagas: 19, pendentes: 5, vencidas: 1 },
    { month: "Nov/24", pagas: 20, pendentes: 3, vencidas: 2 },
    { month: "Dez/24", pagas: 21, pendentes: 4, vencidas: 1 },
    { month: "Jan/25", pagas: 17, pendentes: 6, vencidas: 2 },
    { month: "Fev/25", pagas: 14, pendentes: 8, vencidas: 3 },
  ];

  const collectionRateData = [
    { month: "Set/24", rate: 88, target: 90 },
    { month: "Out/24", rate: 91, target: 90 },
    { month: "Nov/24", rate: 89, target: 90 },
    { month: "Dez/24", rate: 93, target: 90 },
    { month: "Jan/25", rate: 85, target: 90 },
    { month: "Fev/25", rate: 87, target: 90 },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page Header (single h1, action on right) ── */}
      <PageHeader
        title="Dashboard"
        subtitle="Visão consolidada de cobranças e recebimentos"
        period={periodLabel}
        primaryAction={{ label: "Nova Cobrança", href: "/cobrancas/nova" }}
        secondaryActions={[
          { label: "Insights", href: "/insights", icon: <Sparkles className="h-4 w-4" /> },
        ]}
      />

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Competence pills */}
        <div className="flex items-center gap-1.5">
          {["Fev/26", "Jan/26", "Dez/25", "Nov/25"].map((comp) => (
            <button
              key={comp}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                comp === "Fev/26"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {comp}
            </button>
          ))}
        </div>
        {/* Status pills */}
        <div className="flex items-center gap-1.5">
          {["Todos", "Pagos", "Em Aberto", "Vencidos"].map((s) => (
            <button
              key={s}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                s === "Todos"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards (2 cols) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KpiTile
          title="Total Emitido"
          value={`R$ ${(stats.totalAmount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle={`${stats.total} cobranças · ${getCurrentPeriodLabel()} até hoje`}
          trend={{ value: 12, direction: "up" }}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KpiTile
          title="Total Recebido"
          value={`R$ ${(stats.paidAmount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle={`${stats.paid} pagas · ${getCurrentPeriodLabel()} até hoje`}
          trend={{ value: 8, direction: "up" }}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiTile
          title="Taxa de Inadimplência"
          value={`${inadRate}%`}
          subtitle={`${stats.overdue} vencidas · comparação: ${getCurrentPeriodLabel()} (D+30 vs D+30)`}
          trend={{ value: 2.1, direction: "down" }}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={Number(inadRate) > 10 ? "danger" : "default"}
        />
        <KpiTile
          title="Cobranças Pendentes"
          value={String(stats.pending)}
          subtitle={`De ${stats.total} emitidas no período`}
          trend={{ value: 5, direction: "down" }}
          icon={<FileText className="h-5 w-5" />}
        />
      </div>

      {/* ── Charts (2 cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Receita Mensal" subtitle="Últimos 6 meses">
          <StripeRevenueChart data={revenueData} />
        </ChartCard>
        <ChartCard title="Formas de Pagamento" subtitle={periodLabel}>
          <StripePaymentMethodsChart data={paymentMethodsData} />
        </ChartCard>
        <ChartCard title="Status das Cobranças" subtitle={periodLabel}>
          <StripeChargesStatusChart data={chargesStatusData} />
        </ChartCard>
        <ChartCard title="Taxa de Recebimento" subtitle="Evolução mensal">
          <StripeCollectionRateChart data={collectionRateData} />
        </ChartCard>
      </div>

      {/* ── Heatmap ── */}
      <HeatmapTile />

      {/* ── Demo Controls (compact, muted) ── */}
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Ambiente de demonstração
          </span>
          {demoDate && (
            <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
              Data simulada: {new Date(demoDate).toLocaleDateString("pt-BR")}
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={runDunning}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {isRunning ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Play className="h-3 w-3" aria-hidden="true" />}
              Rodar régua
            </button>
            <button
              onClick={() => simulateDays(7)}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <FastForward className="h-3 w-3" aria-hidden="true" />
              +7 dias
            </button>
            <button
              onClick={resetDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Resetar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
