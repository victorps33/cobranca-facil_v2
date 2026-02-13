"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/cn";
import { ChartCard } from "@/components/charts/stripe-charts";
import type { CrmCustomer } from "@/lib/types/crm";
import type { CrmTask as ApiCrmTask } from "@/lib/types/crm";
import type { CrmInteraction as ApiCrmInteraction } from "@/lib/types/crm";
import {
  Mail,
  MessageCircle,
  Phone,
  Smartphone,
  StickyNote,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

// ── Constants ──

const healthColors: Record<string, string> = {
  Saudável: "#10b981",
  Controlado: "#3b82f6",
  "Exige Atenção": "#f59e0b",
  Crítico: "#ef4444",
};

const healthOrder = ["Saudável", "Controlado", "Exige Atenção", "Crítico"];

type InteractionType = "EMAIL" | "WHATSAPP" | "SMS" | "TELEFONE" | "NOTA_INTERNA";

const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  TELEFONE: "Telefone",
  NOTA_INTERNA: "Nota Interna",
};

const typeIcons: Record<InteractionType, typeof Mail> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: Smartphone,
  TELEFONE: Phone,
  NOTA_INTERNA: StickyNote,
};

const typeColors: Record<string, string> = {
  EMAIL: "#3b82f6",
  WHATSAPP: "#22c55e",
  SMS: "#a855f7",
  TELEFONE: "#f59e0b",
  NOTA_INTERNA: "#6b7280",
};

const agingColors = ["#fbbf24", "#f97316", "#ef4444", "#991b1b"];

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

// ── Component ──

interface CrmDashboardProps {
  customers: CrmCustomer[];
  onNavigateToTasks?: () => void;
}

export function CrmDashboard({ customers, onNavigateToTasks }: CrmDashboardProps) {
  const [tasks, setTasks] = useState<ApiCrmTask[]>([]);
  const [interactions, setInteractions] = useState<ApiCrmInteraction[]>([]);

  useEffect(() => {
    fetch("/api/crm/tasks")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]));

    fetch("/api/crm/interactions")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => setInteractions(Array.isArray(data) ? data : []))
      .catch(() => setInteractions([]));
  }, []);

  const mappedInteractions = useMemo(() => {
    return interactions.map((i) => {
      const raw = i as ApiCrmInteraction & { customer?: { name?: string } };
      return {
        id: raw.id ?? "",
        customerId: raw.customerId ?? "",
        customerName: raw.customer?.name ?? raw.customerName ?? "",
        type: (raw.type as InteractionType) ?? "EMAIL",
        content: raw.content ?? "",
        createdAt: raw.createdAt ?? "",
      };
    });
  }, [interactions]);

  const mappedTasks = useMemo(() => {
    return tasks.map((t) => ({
      id: t.id ?? "",
      status: t.status ?? "PENDENTE",
      dueDate: t.dueDate ?? null,
    }));
  }, [tasks]);

  // ── Computed data ──

  const healthData = useMemo(() => {
    const counts: Record<string, number> = {};
    customers.forEach((c) => {
      counts[c.healthStatus] = (counts[c.healthStatus] || 0) + 1;
    });
    return healthOrder
      .filter((name) => counts[name] > 0)
      .map((name) => ({
        name,
        value: counts[name],
        color: healthColors[name] || "#6b7280",
        pct: customers.length > 0 ? Math.round((counts[name] / customers.length) * 100) : 0,
      }));
  }, [customers]);

  const taskStats = useMemo(() => {
    const hoje = new Date();
    const pendentes = mappedTasks.filter((t) => t.status === "PENDENTE").length;
    const emAndamento = mappedTasks.filter((t) => t.status === "EM_ANDAMENTO").length;
    const concluidas = mappedTasks.filter((t) => t.status === "CONCLUIDA").length;
    const atrasadas = mappedTasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) < hoje &&
        (t.status === "PENDENTE" || t.status === "EM_ANDAMENTO")
    ).length;
    return { pendentes, emAndamento, concluidas, atrasadas, total: mappedTasks.length };
  }, [mappedTasks]);

  const agingData = useMemo(() => {
    const totalVencido = customers.reduce((s, c) => s + c.totalVencido, 0);
    const overdueCustomers = customers.filter((c) => c.totalVencido > 0);
    const buckets = { "1–15d": 0, "16–30d": 0, "31–60d": 0, "60d+": 0 };
    overdueCustomers.forEach((c) => {
      if (c.healthStatus === "Controlado") buckets["1–15d"] += c.totalVencido;
      else if (c.healthStatus === "Exige Atenção") buckets["16–30d"] += c.totalVencido;
      else if (c.healthStatus === "Crítico" && c.inadimplencia <= 0.25) buckets["31–60d"] += c.totalVencido;
      else buckets["60d+"] += c.totalVencido;
    });
    const maxBucket = Math.max(...Object.values(buckets), 1);
    return {
      total: totalVencido,
      count: overdueCustomers.length,
      buckets: Object.entries(buckets).map(([faixa, valor], i) => ({
        faixa,
        valor,
        color: agingColors[i],
        pct: Math.round((valor / maxBucket) * 100),
      })),
    };
  }, [customers]);

  const interactionsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    mappedInteractions.forEach((i) => { counts[i.type] = (counts[i.type] || 0) + 1; });
    const total = mappedInteractions.length;
    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        label: INTERACTION_TYPE_LABELS[type as InteractionType] || type,
        count,
        color: typeColors[type] || "#6b7280",
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [mappedInteractions]);

  const recentActivity = useMemo(() => {
    return [...mappedInteractions]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  }, [mappedInteractions]);

  const totalInteractions = mappedInteractions.length;

  const fmtRelative = (dateStr: string) => {
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoje";
    if (days === 1) return "Ontem";
    if (days < 7) return `${days}d atrás`;
    if (days < 30) return `${Math.floor(days / 7)}sem atrás`;
    return `${Math.floor(days / 30)}m atrás`;
  };

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Row 1: 3 cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Saúde do Portfólio */}
        <div className="h-full animate-in stagger-5">
          <ChartCard compact title="Saúde do Portfólio" subtitle={`${customers.length} clientes`}>
            <div className="space-y-3">
              {/* Stacked bar */}
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                {healthData.map((d) => (
                  <div
                    key={d.name}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                    style={{ width: `${d.pct}%`, backgroundColor: d.color }}
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {healthData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="text-xs font-medium text-gray-900 tabular-nums">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Tarefas */}
        <div className="h-full animate-in stagger-6">
          <ChartCard
            title="Tarefas"
            subtitle={`${taskStats.total} no total`}
            action={
              <button
                onClick={onNavigateToTasks}
                className="text-xs text-primary hover:text-primary-hover font-medium inline-flex items-center gap-1 transition-colors"
              >
                Ver todas <ArrowRight className="h-3 w-3" />
              </button>
            }
          >
            <div className="space-y-3">
              {[
                { label: "Pendentes", value: taskStats.pendentes, color: "#fbbf24" },
                { label: "Em Andamento", value: taskStats.emAndamento, color: "#3b82f6" },
                { label: "Concluídas", value: taskStats.concluidas, color: "#10b981" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-medium text-gray-900 tabular-nums">{item.value}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${taskStats.total > 0 ? (item.value / taskStats.total) * 100 : 0}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
              {taskStats.atrasadas > 0 && (
                <p className="text-xs text-red-600 font-medium tabular-nums pt-1">
                  {taskStats.atrasadas} atrasada{taskStats.atrasadas > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </ChartCard>
        </div>

        {/* Aging de Inadimplência */}
        <div className="h-full animate-in stagger-7">
          <ChartCard
            title="Aging de Inadimplência"
            subtitle={`${agingData.count} clientes · ${fmtBRL(agingData.total)}`}
          >
            <div className="space-y-2.5">
              {agingData.buckets.map((bucket) => (
                <div key={bucket.faixa}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{bucket.faixa}</span>
                    <span className="text-gray-900 font-medium tabular-nums">{fmtBRL(bucket.valor)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${bucket.pct}%`, backgroundColor: bucket.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Row 2: 2 cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Interações por Tipo */}
        <div className="h-full animate-in stagger-8">
          <ChartCard compact title="Interações por Tipo" subtitle={`${totalInteractions} no total`}>
            <div className="space-y-3">
              {interactionsByType.map((item) => {
                const Icon = typeIcons[item.type as InteractionType] ?? StickyNote;
                return (
                  <div key={item.type} className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center h-7 w-7 rounded-lg shrink-0"
                      style={{ backgroundColor: `${item.color}15` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-gray-700 font-medium">{item.label}</span>
                        <span className="text-gray-500 tabular-nums">{item.count} ({item.pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {interactionsByType.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhuma interação registrada.</p>
              )}
            </div>
          </ChartCard>
        </div>

        {/* Atividade Recente */}
        <div className="h-full animate-in stagger-9">
          <ChartCard compact title="Atividade Recente" subtitle="Últimas interações">
            <div className="space-y-1">
              {recentActivity.map((activity) => {
                const Icon = typeIcons[activity.type as InteractionType] ?? StickyNote;
                return (
                  <Link
                    key={activity.id}
                    href={`/crm/${activity.customerId}`}
                    className="flex items-center gap-3 group rounded-lg px-2 py-2 -mx-2 hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="flex items-center justify-center h-7 w-7 rounded-lg shrink-0"
                      style={{ backgroundColor: `${typeColors[activity.type]}15` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: typeColors[activity.type] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-900 font-medium group-hover:text-primary transition-colors truncate">
                        {activity.customerName || "Cliente"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{activity.content}</p>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
                      {fmtRelative(activity.createdAt)}
                    </span>
                  </Link>
                );
              })}
              {recentActivity.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhuma atividade recente.</p>
              )}
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
