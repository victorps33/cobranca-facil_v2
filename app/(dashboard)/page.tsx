"use client";

import { useState, useEffect } from "react";
import { getFranqueadoraHeaders } from "@/lib/fetch-with-tenant";
import { useFranqueadora } from "@/components/providers/FranqueadoraProvider";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/ui/metric-card";
import { DataEmptyState } from "@/components/layout/DataEmptyState";
import {
  ChartCard,
  StripeRevenueChart,
  StripePaymentMethodsChart,
  StripeChargesStatusChart,
  SafraCurveChart,
} from "@/components/charts/stripe-charts";
import { KpiSkeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  FileText,
  Users,
} from "lucide-react";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";

interface DashboardData {
  empty: boolean;
  competencias?: { label: string; value: string }[];
  kpisByCompetencia?: Record<string, {
    totalEmitido: number;
    totalRecebido: number;
    totalAberto: number;
    total: number;
    pagas: number;
    vencidas: number;
    abertas: number;
  }>;
  charts?: {
    revenueData: { month: string; revenue: number; projected: number }[];
    chargesStatusData: { month: string; pagas: number; pendentes: number; vencidas: number }[];
    paymentMethodsData: { month: string; boleto: number; pix: number; cartao: number }[];
  };
}

interface OnboardingStatus {
  showWizard: boolean;
  showChecklist: boolean;
  checklist: {
    hasCustomer: boolean;
    hasCharge: boolean;
    hasDunningRule: boolean;
    hasVisitedInsights: boolean;
  };
}

export default function DashboardPage() {
  const { activeFranqueadoraId } = useFranqueadora();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCompetencia, setSelectedCompetencia] = useState("all");
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);

  useEffect(() => {
    setLoading(true);
    const tenantHeaders = getFranqueadoraHeaders();

    fetch("/api/dashboard", { headers: tenantHeaders })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setSelectedCompetencia("all");
      })
      .finally(() => setLoading(false));

    fetch("/api/onboarding/status", { headers: tenantHeaders })
      .then((r) => r.json())
      .then((status: OnboardingStatus) => setOnboarding(status))
      .catch(() => {});
  }, [activeFranqueadoraId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <KpiSkeleton count={4} />
      </div>
    );
  }

  if (!data || data.empty) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          primaryAction={{ label: "Cadastrar Cliente", href: "/clientes/novo" }}
        />
        {onboarding && (
          <OnboardingChecklist
            checklist={onboarding.checklist}
            show={onboarding.showChecklist}
            onDismiss={() => setOnboarding((prev) => prev ? { ...prev, showChecklist: false } : prev)}
          />
        )}
        <DataEmptyState
          title="Bem-vindo à Menlo!"
          description="Comece cadastrando seus clientes e criando cobranças para ver seus dados aqui."
          actionLabel="Cadastrar Cliente"
          actionHref="/clientes"
          icon={<Users className="h-6 w-6 text-gray-400" />}
        />
      </div>
    );
  }

  const competencias = data.competencias || [];
  const kpis = data.kpisByCompetencia || {};

  const isAll = selectedCompetencia === "all";
  const selectedLabel = isAll
    ? "Todas"
    : competencias.find((c) => c.value === selectedCompetencia)?.label || "";
  const periodLabel = isAll
    ? "Todas as competências"
    : `Competência: ${selectedLabel}`;

  // KPIs: aggregate all or single competência
  const emptyKpi = { totalEmitido: 0, totalRecebido: 0, totalAberto: 0, total: 0, pagas: 0, vencidas: 0, abertas: 0 };
  const currentKpi = isAll
    ? Object.values(kpis).reduce((acc, k) => ({
        totalEmitido: acc.totalEmitido + k.totalEmitido,
        totalRecebido: acc.totalRecebido + k.totalRecebido,
        totalAberto: acc.totalAberto + k.totalAberto,
        total: acc.total + k.total,
        pagas: acc.pagas + k.pagas,
        vencidas: acc.vencidas + k.vencidas,
        abertas: acc.abertas + k.abertas,
      }), { ...emptyKpi })
    : kpis[selectedCompetencia] || emptyKpi;

  const inadRate = currentKpi.totalEmitido > 0
    ? ((currentKpi.totalAberto / currentKpi.totalEmitido) * 100).toFixed(1)
    : "0.0";

  // Trend vs previous competência (only when a single competência is selected)
  let trendEmitido = 0;
  let trendRecebido = 0;
  let trendInad = 0;
  let trendPendentes = 0;

  if (!isAll) {
    const currentIdx = competencias.findIndex((c) => c.value === selectedCompetencia);
    const prevComp = currentIdx < competencias.length - 1 ? competencias[currentIdx + 1] : null;
    if (prevComp && kpis[prevComp.value]) {
      const prevKpi = kpis[prevComp.value];
      if (prevKpi.totalEmitido > 0) {
        trendEmitido = Math.round(((currentKpi.totalEmitido - prevKpi.totalEmitido) / prevKpi.totalEmitido) * 100);
        const prevInad = (prevKpi.totalAberto / prevKpi.totalEmitido) * 100;
        trendInad = Math.round((Number(inadRate) - prevInad) * 10) / 10;
      }
      if (prevKpi.totalRecebido > 0) {
        trendRecebido = Math.round(((currentKpi.totalRecebido - prevKpi.totalRecebido) / prevKpi.totalRecebido) * 100);
      }
      const prevPendentes = prevKpi.abertas + prevKpi.vencidas;
      const currPendentes = currentKpi.abertas + currentKpi.vencidas;
      if (prevPendentes > 0) {
        trendPendentes = Math.round(((currPendentes - prevPendentes) / prevPendentes) * 100);
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        period={periodLabel}
        primaryAction={{ label: "Nova Cobrança", href: "/cobrancas/nova" }}
      />

      {onboarding && (
        <OnboardingChecklist
          checklist={onboarding.checklist}
          show={onboarding.showChecklist}
          onDismiss={() => setOnboarding((prev) => prev ? { ...prev, showChecklist: false } : prev)}
        />
      )}

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
          title="Total Emitido"
          value={`R$ ${(currentKpi.totalEmitido / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle={`${currentKpi.total} cobranças · ${selectedLabel}`}
          trend={{ value: Math.abs(trendEmitido), direction: trendEmitido >= 0 ? "up" : "down" }}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          className="animate-in stagger-2"
          title="Total Recebido"
          value={`R$ ${(currentKpi.totalRecebido / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle={`${currentKpi.pagas} pagas · ${selectedLabel}`}
          trend={{ value: Math.abs(trendRecebido), direction: trendRecebido >= 0 ? "up" : "down" }}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          className="animate-in stagger-3"
          title="Taxa de Inadimplência"
          value={`${inadRate}%`}
          subtitle={`${currentKpi.vencidas} vencidas · ${selectedLabel}`}
          tooltip="Percentual do valor emitido que está vencido e não foi pago"
          trend={{ value: Math.abs(trendInad), direction: trendInad <= 0 ? "down" : "up" }}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={Number(inadRate) > 15 ? "danger" : "default"}
        />
        <MetricCard
          className="animate-in stagger-4"
          title="Cobranças Pendentes"
          value={String(currentKpi.abertas + currentKpi.vencidas)}
          subtitle={`De ${currentKpi.total} emitidas · ${selectedLabel}`}
          trend={{ value: Math.abs(trendPendentes), direction: trendPendentes <= 0 ? "down" : "up" }}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      {data.charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="animate-in stagger-5">
            <ChartCard title="Recebido vs. Emitido" subtitle="Últimos períodos">
              <StripeRevenueChart data={data.charts.revenueData} />
            </ChartCard>
          </div>
          <div className="animate-in stagger-6">
            <ChartCard title="Status das Cobranças" subtitle="Evolução mensal">
              <StripeChargesStatusChart data={data.charts.chargesStatusData} />
            </ChartCard>
          </div>
          <div className="animate-in stagger-7">
            <ChartCard title="Formas de Pagamento" subtitle="Distribuição por mês">
              <StripePaymentMethodsChart data={data.charts.paymentMethodsData} />
            </ChartCard>
          </div>
        </div>
      )}

    </div>
  );
}
