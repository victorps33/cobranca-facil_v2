"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/cn";
import type { CrmCustomer } from "@/lib/types/crm";
import type { CrmTask as ApiCrmTask } from "@/lib/types/crm";
import type { CrmInteraction as ApiCrmInteraction } from "@/lib/types/crm";
import {
  Mail,
  MessageCircle,
  Phone,
  Smartphone,
  StickyNote,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

// ── Colors ──

const healthColors: Record<string, string> = {
  Saudável: "#10b981",
  Controlado: "#3b82f6",
  "Exige Atenção": "#f59e0b",
  Crítico: "#ef4444",
};

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

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

interface CrmDashboardProps {
  customers: CrmCustomer[];
  onNavigateToTasks?: () => void;
}

export function CrmDashboard({ customers, onNavigateToTasks }: CrmDashboardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Fetch tasks and interactions for dashboard
  const [tasks, setTasks] = useState<ApiCrmTask[]>([]);
  const [interactions, setInteractions] = useState<ApiCrmInteraction[]>([]);

  useEffect(() => {
    fetch("/api/crm/tasks")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]));

    fetch("/api/crm/interactions")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setInteractions(Array.isArray(data) ? data : []))
      .catch(() => setInteractions([]));
  }, []);

  // Map API interactions (they come with nested customer/createdBy)
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

  // Map API tasks
  const mappedTasks = useMemo(() => {
    return tasks.map((t) => ({
      id: t.id ?? "",
      status: t.status ?? "PENDENTE",
      dueDate: t.dueDate ?? null,
    }));
  }, [tasks]);

  // ── Health distribution (pie) ──
  const healthData = useMemo(() => {
    const counts: Record<string, number> = {};
    customers.forEach((c) => {
      counts[c.healthStatus] = (counts[c.healthStatus] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: healthColors[name] || "#6b7280",
    }));
  }, [customers]);

  // ── Interactions by type (bar) ──
  const interactionsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    mappedInteractions.forEach((i) => {
      counts[i.type] = (counts[i.type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        label: INTERACTION_TYPE_LABELS[type as InteractionType] || type,
        count,
        color: typeColors[type] || "#6b7280",
      }))
      .sort((a, b) => b.count - a.count);
  }, [mappedInteractions]);

  // ── Task stats ──
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
    return { pendentes, emAndamento, concluidas, atrasadas };
  }, [mappedTasks]);

  // ── Overdue aging buckets (from customers' totalVencido) ──
  const agingData = useMemo(() => {
    // Without individual charge data, show aggregated customer overdue
    const totalVencido = customers.reduce((s, c) => s + c.totalVencido, 0);
    const overdueCustomers = customers.filter((c) => c.totalVencido > 0);

    // Simple distribution based on healthStatus as proxy
    const buckets = { "1-15d": 0, "16-30d": 0, "31-60d": 0, "60d+": 0 };
    overdueCustomers.forEach((c) => {
      if (c.healthStatus === "Controlado") buckets["1-15d"] += c.totalVencido;
      else if (c.healthStatus === "Exige Atenção") buckets["16-30d"] += c.totalVencido;
      else if (c.healthStatus === "Crítico" && c.inadimplencia <= 0.25) buckets["31-60d"] += c.totalVencido;
      else buckets["60d+"] += c.totalVencido;
    });

    return {
      total: totalVencido,
      count: overdueCustomers.length,
      buckets: [
        { faixa: "1-15d", valor: buckets["1-15d"], color: "#fbbf24" },
        { faixa: "16-30d", valor: buckets["16-30d"], color: "#f97316" },
        { faixa: "31-60d", valor: buckets["31-60d"], color: "#ef4444" },
        { faixa: "60d+", valor: buckets["60d+"], color: "#991b1b" },
      ],
    };
  }, [customers]);

  // ── Recent activity ──
  const recentActivity = useMemo(() => {
    return [...mappedInteractions]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  }, [mappedInteractions]);

  const fmtRelative = (dateStr: string) => {
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoje";
    if (days === 1) return "Ontem";
    if (days < 7) return `${days}d atrás`;
    if (days < 30) return `${Math.floor(days / 7)}sem atrás`;
    return `${Math.floor(days / 30)}m atrás`;
  };

  const totalInteractions = mappedInteractions.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Saúde do Portfólio (pie chart) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Saúde do Portfólio</h3>
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 shrink-0">
              {mounted && (
                <CrmPieChart data={healthData} />
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              {healthData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    {d.name}
                  </span>
                  <span className="font-medium text-gray-900 tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tarefas (funnel/summary) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Tarefas</h3>
            <button
              onClick={onNavigateToTasks}
              className="text-xs text-primary hover:text-primary-hover font-medium inline-flex items-center gap-1"
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { label: "Pendentes", value: taskStats.pendentes, color: "bg-yellow-400", total: mappedTasks.length },
              { label: "Em Andamento", value: taskStats.emAndamento, color: "bg-blue-400", total: mappedTasks.length },
              { label: "Concluídas", value: taskStats.concluidas, color: "bg-emerald-400", total: mappedTasks.length },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium text-gray-900 tabular-nums">{item.value}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", item.color)}
                    style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {taskStats.atrasadas > 0 && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-red-50 rounded-lg">
                <Clock className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs font-medium text-red-700">
                  {taskStats.atrasadas} tarefa{taskStats.atrasadas > 1 ? "s" : ""} atrasada{taskStats.atrasadas > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Aging de Inadimplência ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Aging de Inadimplência</h3>
          <p className="text-xs text-gray-400 mb-3">
            {agingData.count} clientes inadimplentes · {fmtBRL(agingData.total)}
          </p>
          <div className="h-32">
            {mounted && (
              <CrmBarChart data={agingData.buckets} />
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Interactions by type + Recent activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Interactions by type */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Interações por Tipo
            <span className="text-xs font-normal text-gray-400 ml-2">
              {totalInteractions} total
            </span>
          </h3>
          <div className="space-y-2.5">
            {interactionsByType.map((item) => {
              const Icon = typeIcons[item.type as InteractionType] ?? StickyNote;
              const pct = totalInteractions > 0
                ? Math.round((item.count / totalInteractions) * 100)
                : 0;
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
                      <span className="text-gray-500 tabular-nums">{item.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Atividade Recente</h3>
          <div className="space-y-3">
            {recentActivity.map((activity) => {
              const Icon = typeIcons[activity.type as InteractionType] ?? StickyNote;
              return (
                <Link
                  key={activity.id}
                  href={`/crm/${activity.customerId}`}
                  className="flex items-start gap-3 group"
                >
                  <div
                    className="flex items-center justify-center h-7 w-7 rounded-lg shrink-0 mt-0.5"
                    style={{ backgroundColor: `${typeColors[activity.type]}15` }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: typeColors[activity.type] }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-900 font-medium group-hover:text-primary transition-colors truncate">
                      {activity.customerName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{activity.content}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                    {fmtRelative(activity.createdAt)}
                  </span>
                </Link>
              );
            })}
            {recentActivity.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Nenhuma atividade recente.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recharts wrappers (only rendered client-side) ──

function CrmPieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
  } = require("recharts");

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={28}
          outerRadius={50}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((entry: { name: string; color: string }) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function CrmBarChart({ data }: { data: { faixa: string; valor: number; color: string }[] }) {
  const {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    ResponsiveContainer,
  } = require("recharts");

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
        <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${(v / 100).toLocaleString("pt-BR", { notation: "compact" as const })}`}
          width={45}
        />
        <Tooltip
          formatter={(value: number) => [fmtBRL(value), "Valor"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
          {data.map((entry: { faixa: string; color: string }) => (
            <Cell key={entry.faixa} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
