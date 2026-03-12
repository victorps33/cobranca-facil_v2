"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getFranqueadoraHeaders } from "@/lib/fetch-with-tenant";
import { useFranqueadora } from "@/components/providers/FranqueadoraProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResolverChipRow } from "@/components/reguas/resolver-chips";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface StepStats {
  id: string;
  trigger: string;
  offsetDays: number;
  channel: string;
  phase: string;
  timingMode: string;
  channelMode: string;
  contentMode: string;
  fallbackTime: string | null;
  resolverStats: {
    bestHourStart: string | null;
    bestHourEnd: string | null;
    timingLift: number | null;
    bestChannel: string | null;
    channelLift: number | null;
    channelRates: Record<string, number> | null;
    winnerVariantId: string | null;
    contentLift: number | null;
    timingConfidence: number;
    channelConfidence: number;
    contentConfidence: number;
  } | null;
  variants: {
    id: string;
    label: string;
    template: string;
    active: boolean;
    sends: number;
    openRate: number;
    replyRate: number;
    conversionRate: number;
    isWinner: boolean;
  }[];
}

interface KPIs {
  totalSteps: number;
  smartSteps: number;
  totalSent: number;
  totalPaid: number;
  recoveryRate: number;
}

interface HeatmapData {
  heatmap: Record<string, Record<string, number>>;
  totalEvents: number;
}

interface ChannelData {
  sent: { channel: string; _count: number }[];
  replied: { channel: string; _count: number }[];
  paid: { channel: string; _count: number }[];
}

export default function IntelligenceDashboardPage() {
  const params = useParams();
  const { activeFranqueadoraId } = useFranqueadora();

  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<StepStats[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [channelData, setChannelData] = useState<ChannelData | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/intelligence/stats?ruleId=${params.id}`,
        { headers: getFranqueadoraHeaders() }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSteps(data.steps);
      setKpis(data.kpis);
      if (data.steps.length > 0 && !selectedStepId) {
        setSelectedStepId(data.steps[0].id);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [params.id, selectedStepId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, activeFranqueadoraId]);

  // Fetch heatmap and channel data for selected step
  useEffect(() => {
    if (!selectedStepId) return;

    const fetchDetails = async () => {
      const headers = getFranqueadoraHeaders();
      const [heatmapRes, channelRes] = await Promise.all([
        fetch(
          `/api/intelligence/events?type=heatmap&stepId=${selectedStepId}`,
          { headers }
        ),
        fetch(
          `/api/intelligence/events?type=channels&stepId=${selectedStepId}`,
          { headers }
        ),
      ]);

      if (heatmapRes.ok) setHeatmap(await heatmapRes.json());
      if (channelRes.ok) setChannelData(await channelRes.json());
    };

    fetchDetails();
  }, [selectedStepId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const selectedStep = steps.find((s) => s.id === selectedStepId);

  const formatStepLabel = (s: StepStats) => {
    if (s.trigger === "BEFORE_DUE") return `D-${s.offsetDays}`;
    if (s.trigger === "ON_DUE") return "D0";
    return `D+${s.offsetDays}`;
  };

  // Prepare channel chart data
  const channelChartData = channelData
    ? channelData.sent.map((s) => {
        const replied =
          channelData.replied.find((r) => r.channel === s.channel)?._count || 0;
        const paid =
          channelData.paid.find((p) => p.channel === s.channel)?._count || 0;
        return {
          channel: s.channel,
          enviados: s._count,
          respostas: replied,
          pagamentos: paid,
        };
      })
    : [];

  // Prepare heatmap grid
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7-20

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/reguas/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Painel de Inteligencia</h1>
          <p className="text-sm text-gray-500">
            Metricas e otimizacoes da regua
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Taxa de Recuperacao"
            value={`${Math.round(kpis.recoveryRate * 100)}%`}
            color="purple"
          />
          <KpiCard
            label="Mensagens Enviadas"
            value={kpis.totalSent.toLocaleString()}
            color="blue"
          />
          <KpiCard
            label="Pagamentos"
            value={kpis.totalPaid.toLocaleString()}
            color="green"
          />
          <KpiCard
            label="Steps Inteligentes"
            value={`${kpis.smartSteps}/${kpis.totalSteps}`}
            color="purple"
          />
        </div>
      )}

      {/* Step selector */}
      <div className="flex gap-2 flex-wrap">
        {steps.map((s) => {
          const isSmart =
            s.timingMode === "SMART" ||
            s.channelMode === "SMART" ||
            s.contentMode === "SMART";
          return (
            <button
              key={s.id}
              onClick={() => setSelectedStepId(s.id)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                selectedStepId === s.id
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-purple-300"
              }`}
            >
              {formatStepLabel(s)} · {s.channel}
              {isSmart && (
                <Badge className="ml-1.5 bg-purple-100 text-purple-700 text-[9px]">
                  IA
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {selectedStep && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resolver chips + stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold">Resolvers</h3>
            <ResolverChipRow step={selectedStep as any} />
            {selectedStep.resolverStats && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                <StatBox
                  label="Confianca Horario"
                  value={`${Math.round(selectedStep.resolverStats.timingConfidence * 100)}%`}
                />
                <StatBox
                  label="Confianca Canal"
                  value={`${Math.round(selectedStep.resolverStats.channelConfidence * 100)}%`}
                />
                <StatBox
                  label="Confianca Conteudo"
                  value={`${Math.round(selectedStep.resolverStats.contentConfidence * 100)}%`}
                />
              </div>
            )}
          </div>

          {/* Heatmap */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold">
              Mapa de Aberturas (ultimos 30 dias)
            </h3>
            {heatmap && heatmap.totalEvents > 0 ? (
              <div className="overflow-x-auto">
                <div className="grid gap-0.5" style={{ gridTemplateColumns: `40px repeat(${hours.length}, 1fr)` }}>
                  <div />
                  {hours.map((h) => (
                    <div key={h} className="text-[9px] text-gray-400 text-center">
                      {h}h
                    </div>
                  ))}
                  {days.map((day) => (
                    <>
                      <div key={`label-${day}`} className="text-[10px] text-gray-500 flex items-center">
                        {day}
                      </div>
                      {hours.map((h) => {
                        const count = heatmap.heatmap[day]?.[h.toString()] || 0;
                        const maxCount = Math.max(
                          1,
                          ...Object.values(heatmap.heatmap).flatMap((d) =>
                            Object.values(d)
                          )
                        );
                        const intensity = count / maxCount;
                        return (
                          <div
                            key={`${day}-${h}`}
                            className="aspect-square rounded-sm"
                            style={{
                              backgroundColor:
                                count === 0
                                  ? "#f3f4f6"
                                  : `rgba(147, 51, 234, ${0.15 + intensity * 0.85})`,
                            }}
                            title={`${day} ${h}h: ${count} aberturas`}
                          />
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">
                Sem dados de abertura ainda
              </p>
            )}
          </div>

          {/* Channel performance */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold">Performance por Canal</h3>
            {channelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={channelChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="enviados" fill="#93c5fd" name="Enviados" />
                  <Bar dataKey="respostas" fill="#818cf8" name="Respostas" />
                  <Bar dataKey="pagamentos" fill="#34d399" name="Pagamentos" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">
                Sem dados de canal ainda
              </p>
            )}
          </div>

          {/* Variant performance */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold">Variantes</h3>
            {selectedStep.variants.length > 0 ? (
              <div className="space-y-2">
                {selectedStep.variants.map((v) => (
                  <div
                    key={v.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs ${
                      v.isWinner
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <span className="font-bold text-gray-700 w-6">{v.label}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-500 line-clamp-1">
                        {v.template}
                      </span>
                    </div>
                    <div className="flex gap-3 shrink-0 text-[10px]">
                      <span className="text-gray-400">{v.sends} envios</span>
                      <span className="text-blue-500">
                        {Math.round(v.openRate * 100)}% abert.
                      </span>
                      <span className="text-purple-500">
                        {Math.round(v.replyRate * 100)}% resp.
                      </span>
                      <span className="text-green-600 font-semibold">
                        {Math.round(v.conversionRate * 100)}% conv.
                      </span>
                      {v.isWinner && (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[8px]">
                          WINNER
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">
                Nenhuma variante criada
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "purple" | "blue" | "green";
}) {
  const colors = {
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-emerald-50 border-emerald-200 text-emerald-700",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">
        {label}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <div className="text-sm font-semibold text-gray-700">{value}</div>
      <div className="text-[9px] text-gray-400">{label}</div>
    </div>
  );
}
