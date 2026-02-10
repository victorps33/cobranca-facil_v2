"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import {
  Bot,
  Brain,
  MessageSquare,
  AlertTriangle,
  Send,
  XCircle,
  Clock,
  TrendingUp,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

interface DashboardData {
  totalDecisions: number;
  decisionsToday: number;
  decisions7d: number;
  escalationsActive: number;
  escalationsTotal: number;
  messagesSent: number;
  messagesFailed: number;
  messagesQueued: number;
  conversationsOpen: number;
  conversationsPendingHuman: number;
  avgConfidence: number;
  actionBreakdown: { action: string; count: number }[];
  agentEnabled: boolean;
}

interface Decision {
  id: string;
  action: string;
  reasoning: string;
  confidence: number;
  outputMessage?: string;
  escalationReason?: string;
  createdAt: string;
  customer: { id: string; name: string };
  conversation?: { id: string; channel: string } | null;
  charge?: { id: string; description: string; amountCents: number } | null;
}

interface Escalation {
  id: string;
  channel: string;
  status: string;
  lastMessageAt: string;
  customer: { id: string; name: string; email: string; phone: string };
  assignedTo?: { id: string; name: string } | null;
  messages: { content: string }[];
  agentDecisions: {
    reasoning: string;
    escalationReason?: string;
    createdAt: string;
  }[];
}

const actionLabels: Record<string, string> = {
  SEND_COLLECTION: "Cobrança Enviada",
  RESPOND_CUSTOMER: "Resposta ao Cliente",
  ESCALATE_HUMAN: "Escalação",
  NEGOTIATE: "Negociação",
  SKIP: "Ignorada",
  MARK_PROMISE: "Promessa Registrada",
  UPDATE_STATUS: "Status Atualizado",
};

const actionColors: Record<string, string> = {
  SEND_COLLECTION: "bg-blue-50 text-blue-700",
  RESPOND_CUSTOMER: "bg-green-50 text-green-700",
  ESCALATE_HUMAN: "bg-red-50 text-red-700",
  NEGOTIATE: "bg-purple-50 text-purple-700",
  SKIP: "bg-gray-100 text-gray-600",
  MARK_PROMISE: "bg-amber-50 text-amber-700",
  UPDATE_STATUS: "bg-cyan-50 text-cyan-700",
};

export default function AgentDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [activeTab, setActiveTab] = useState<
    "overview" | "decisions" | "escalations"
  >("overview");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/agent/dashboard").then((r) => r.json()),
      fetch("/api/agent/decisions?limit=10").then((r) => r.json()),
      fetch("/api/agent/escalations").then((r) => r.json()),
    ])
      .then(([dash, decs, escs]) => {
        setDashboard(dash);
        setDecisions(decs.decisions || []);
        setEscalations(Array.isArray(escs) ? escs : []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agente AI (Mia)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitoramento do agente autônomo de cobrança
          </p>
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
            dashboard?.agentEnabled
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-500"
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              dashboard?.agentEnabled ? "bg-green-500 animate-pulse" : "bg-gray-400"
            )}
          />
          {dashboard?.agentEnabled ? "Ativo" : "Desativado"}
        </div>
      </div>

      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={Brain}
            label="Decisões Hoje"
            value={dashboard.decisionsToday}
            subtitle={`${dashboard.decisions7d} nos últimos 7 dias`}
            color="text-primary"
          />
          <KPICard
            icon={Send}
            label="Mensagens Enviadas"
            value={dashboard.messagesSent}
            subtitle={`${dashboard.messagesQueued} na fila`}
            color="text-blue-600"
          />
          <KPICard
            icon={AlertTriangle}
            label="Escalações Ativas"
            value={dashboard.escalationsActive}
            subtitle={`${dashboard.escalationsTotal} total`}
            color="text-red-600"
          />
          <KPICard
            icon={TrendingUp}
            label="Confiança Média"
            value={`${(dashboard.avgConfidence * 100).toFixed(0)}%`}
            subtitle={`${dashboard.conversationsOpen} conversas abertas`}
            color="text-green-600"
          />
        </div>
      )}

      {/* Action Breakdown */}
      {dashboard && dashboard.actionBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Distribuição de Ações (30 dias)
          </h3>
          <div className="flex flex-wrap gap-2">
            {dashboard.actionBreakdown.map((ab) => (
              <div
                key={ab.action}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
                  actionColors[ab.action] || "bg-gray-100 text-gray-600"
                )}
              >
                <span className="font-semibold">{ab.count}</span>
                {actionLabels[ab.action] || ab.action}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {(
            [
              { id: "overview", label: "Decisões Recentes" },
              {
                id: "escalations",
                label: `Escalações (${escalations.length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-3 text-sm font-medium transition-colors border-b-2",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-3">
          {decisions.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              Nenhuma decisão registrada ainda
            </p>
          ) : (
            decisions.map((dec) => (
              <div
                key={dec.id}
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        actionColors[dec.action] || "bg-gray-100"
                      )}
                    >
                      {actionLabels[dec.action] || dec.action}
                    </span>
                    <span className="text-xs text-gray-400">
                      Confiança: {(dec.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(dec.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>

                <div className="mt-2">
                  <Link
                    href={`/crm/${dec.customer.id}`}
                    className="text-sm font-medium text-gray-900 hover:text-primary"
                  >
                    {dec.customer.name}
                  </Link>
                  {dec.charge && (
                    <span className="text-xs text-gray-400 ml-2">
                      {dec.charge.description} —{" "}
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(dec.charge.amountCents / 100)}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-500 mt-1">{dec.reasoning}</p>

                {dec.outputMessage && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600 border-l-2 border-primary/30">
                    {dec.outputMessage.slice(0, 200)}
                    {dec.outputMessage.length > 200 ? "..." : ""}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "escalations" && (
        <div className="space-y-3">
          {escalations.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              Nenhuma escalação ativa
            </p>
          ) : (
            escalations.map((esc) => (
              <div
                key={esc.id}
                className="bg-white rounded-xl border border-red-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`/crm/${esc.customer.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-primary"
                    >
                      {esc.customer.name}
                    </Link>
                    <span className="text-xs text-gray-400 ml-2">
                      {esc.channel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/inbox?selected=${esc.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary bg-primary/5 rounded-lg hover:bg-primary/10"
                    >
                      Abrir no Inbox <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {esc.agentDecisions[0] && (
                  <div className="mt-2">
                    {esc.agentDecisions[0].escalationReason && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 mr-2">
                        <AlertTriangle className="h-3 w-3" />
                        {esc.agentDecisions[0].escalationReason}
                      </span>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {esc.agentDecisions[0].reasoning}
                    </p>
                  </div>
                )}

                {esc.messages[0] && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                    Última mensagem: {esc.messages[0].content.slice(0, 150)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: typeof Bot;
  label: string;
  value: string | number;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}
