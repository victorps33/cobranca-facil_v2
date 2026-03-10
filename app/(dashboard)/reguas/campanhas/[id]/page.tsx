"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { getFranqueadoraHeaders } from "@/lib/fetch-with-tenant";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiSkeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MetricCard } from "@/components/ui/metric-card";
import {
  ArrowLeft,
  Calendar,
  Users,
  Percent,
  CreditCard,
  Layers,
  Mail,
  MessageSquare,
  MessageCircle,
  Phone,
  ShieldAlert,
  FileText,
  Scale,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

/* ── Types ── */

interface CampaignStep {
  id: string;
  trigger: "BEFORE_DUE" | "ON_DUE" | "AFTER_DUE";
  offsetDays: number;
  channel: string;
  template: string;
  enabled: boolean;
}

interface CampaignCustomer {
  id: string;
  customer: { id: string; name: string };
  addedAt: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ENDED";
  startDate: string;
  endDate: string;
  maxCashDiscount: number;
  maxInstallments: number;
  monthlyInterestRate: number;
  minInstallmentCents: number;
  targetFilters: Record<string, unknown> | null;
  steps: CampaignStep[];
  customers: CampaignCustomer[];
  _count: { customers: number };
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Rascunho", className: "bg-gray-100 text-gray-600" },
  ACTIVE: { label: "Ativa", className: "bg-emerald-50 text-emerald-700" },
  ENDED: { label: "Encerrada", className: "bg-gray-100 text-gray-400" },
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  EMAIL: <Mail className="h-4 w-4" />,
  SMS: <MessageSquare className="h-4 w-4" />,
  WHATSAPP: <MessageCircle className="h-4 w-4" />,
  LIGACAO: <Phone className="h-4 w-4" />,
  BOA_VISTA: <ShieldAlert className="h-4 w-4" />,
  CARTORIO: <FileText className="h-4 w-4" />,
  JURIDICO: <Scale className="h-4 w-4" />,
};

const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: "E-mail",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  LIGACAO: "Ligação",
  BOA_VISTA: "Boa Vista",
  CARTORIO: "Cartório",
  JURIDICO: "Jurídico",
};

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const headers = getFranqueadoraHeaders();
    fetch(`/api/negotiation-campaigns/${id}`, { headers })
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setCampaign)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/negotiation-campaigns/${id}`, {
        method: "DELETE",
        headers: getFranqueadoraHeaders(),
      });
      if (res.ok) {
        router.push("/reguas?tab=campanhas");
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Campanha" />
        <KpiSkeleton count={4} />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="space-y-6">
        <PageHeader title="Campanha não encontrada" />
        <p className="text-sm text-gray-500">
          Esta campanha não existe ou você não tem acesso.
        </p>
        <button
          onClick={() => router.push("/reguas?tab=campanhas")}
          className="text-sm text-gray-600 underline"
        >
          Voltar para campanhas
        </button>
      </div>
    );
  }

  const status = STATUS_MAP[campaign.status] || STATUS_MAP.DRAFT;
  const start = new Date(campaign.startDate).toLocaleDateString("pt-BR");
  const end = new Date(campaign.endDate).toLocaleDateString("pt-BR");

  // Channel breakdown
  const channelCounts = campaign.steps.reduce<Record<string, number>>((acc, s) => {
    acc[s.channel] = (acc[s.channel] || 0) + 1;
    return acc;
  }, {});

  // Step timeline
  const sortedSteps = [...campaign.steps].sort((a, b) => {
    const triggerOrder = { BEFORE_DUE: 0, ON_DUE: 1, AFTER_DUE: 2 };
    const ta = triggerOrder[a.trigger] ?? 1;
    const tb = triggerOrder[b.trigger] ?? 1;
    if (ta !== tb) return ta - tb;
    return a.offsetDays - b.offsetDays;
  });

  const offsetLabel = (step: CampaignStep) => {
    if (step.trigger === "BEFORE_DUE") return `D-${step.offsetDays}`;
    if (step.trigger === "ON_DUE") return "D0";
    return `D+${step.offsetDays}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/reguas?tab=campanhas")}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">{campaign.name}</h1>
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", status.className)}>
                {status.label}
              </span>
            </div>
            {campaign.description && (
              <p className="text-sm text-gray-500 mt-0.5">{campaign.description}</p>
            )}
          </div>
        </div>
        {campaign.status === "DRAFT" && (
          <button
            onClick={() => setShowDelete(true)}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Período"
          value={`${start.slice(0, 5)} — ${end.slice(0, 5)}`}
          subtitle={`${Math.ceil((new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / (1000 * 60 * 60 * 24))} dias`}
          icon={<Calendar className="h-4 w-4" />}
        />
        <MetricCard
          title="Clientes"
          value={String(campaign._count.customers)}
          subtitle="Incluídos na campanha"
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Desconto máximo"
          value={`${(campaign.maxCashDiscount * 100).toFixed(0)}%`}
          subtitle={`Até ${campaign.maxInstallments}x · Juros ${(campaign.monthlyInterestRate * 100).toFixed(1)}% a.m.`}
          icon={<Percent className="h-4 w-4" />}
        />
        <MetricCard
          title="Etapas"
          value={String(campaign.steps.length)}
          subtitle={`${Object.keys(channelCounts).length} canais`}
          icon={<Layers className="h-4 w-4" />}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Condições comerciais */}
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-50">
            <CreditCard className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Condições Comerciais</h3>
          </div>
          <div className="divide-y divide-gray-50">
            <div className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-gray-600">Desconto à vista</span>
              <span className="text-sm font-semibold text-gray-900">{(campaign.maxCashDiscount * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-gray-600">Parcelas máximas</span>
              <span className="text-sm font-semibold text-gray-900">{campaign.maxInstallments}x</span>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-gray-600">Juros mensal</span>
              <span className="text-sm font-semibold text-gray-900">{(campaign.monthlyInterestRate * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-gray-600">Parcela mínima</span>
              <span className="text-sm font-semibold text-gray-900">R$ {(campaign.minInstallmentCents / 100).toFixed(2)}</span>
            </div>
            {campaign.targetFilters && Object.keys(campaign.targetFilters).length > 0 && (
              <div className="px-6 py-3.5">
                <p className="text-xs text-gray-400 font-medium mb-2">Público-alvo</p>
                <div className="flex flex-wrap gap-1.5">
                  {campaign.targetFilters.minDaysOverdue !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                      Atraso &ge; {String(campaign.targetFilters.minDaysOverdue)} dias
                    </span>
                  )}
                  {campaign.targetFilters.minValueCents !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                      Valor &ge; R$ {(Number(campaign.targetFilters.minValueCents) / 100).toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canais de comunicação */}
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-50">
            <MessageCircle className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Canais de Comunicação</h3>
          </div>
          {Object.keys(channelCounts).length > 0 ? (
            <div className="divide-y divide-gray-50">
              {Object.entries(channelCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">{CHANNEL_ICON[channel] || <Mail className="h-4 w-4" />}</span>
                      <span className="text-sm text-gray-600">{CHANNEL_LABEL[channel] || channel}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{count} {count === 1 ? "etapa" : "etapas"}</span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400">Nenhuma etapa configurada</p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline de etapas */}
      {sortedSteps.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-50">
            <Clock className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Etapas da Campanha</h3>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-0">
              {sortedSteps.map((step, i) => (
                <div key={step.id} className="flex gap-4">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                      step.trigger === "BEFORE_DUE"
                        ? "bg-blue-50 text-blue-600"
                        : step.trigger === "ON_DUE"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-red-50 text-red-600"
                    )}>
                      {offsetLabel(step)}
                    </div>
                    {i < sortedSteps.length - 1 && (
                      <div className="w-px h-8 bg-gray-100" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-4 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-400">{CHANNEL_ICON[step.channel]}</span>
                      <span className="text-sm font-medium text-gray-900">{CHANNEL_LABEL[step.channel] || step.channel}</span>
                      {!step.enabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Desativada</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{step.template}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No steps message */}
      {sortedSteps.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-8 text-center">
          <AlertTriangle className="h-6 w-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Nenhuma etapa configurada nesta campanha.</p>
          <p className="text-xs text-gray-400 mt-1">As etapas definem quando e como os clientes serão contatados.</p>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Excluir campanha?"
        description={`A campanha "${campaign.name}" será excluída permanentemente. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}
