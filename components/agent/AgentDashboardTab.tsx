"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/cn";
import { MetricCard } from "@/components/ui/metric-card";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { Pagination } from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton, KpiSkeleton } from "@/components/ui/skeleton";
import {
  Bot,
  Brain,
  Send,
  AlertTriangle,
  TrendingUp,
  ChevronRight,
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
  SEND_COLLECTION: "Cobranca Enviada",
  RESPOND_CUSTOMER: "Resposta ao Cliente",
  ESCALATE_HUMAN: "Escalacao",
  NEGOTIATE: "Negociacao",
  SKIP: "Ignorada",
  MARK_PROMISE: "Promessa Registrada",
  UPDATE_STATUS: "Status Atualizado",
};

const actionColors: Record<string, string> = {
  SEND_COLLECTION: "bg-blue-50 text-blue-700",
  RESPOND_CUSTOMER: "bg-green-50 text-green-700",
  ESCALATE_HUMAN: "bg-red-50 text-red-700",
  NEGOTIATE: "bg-blue-50 text-blue-700",
  SKIP: "bg-gray-100 text-gray-600",
  MARK_PROMISE: "bg-amber-50 text-amber-700",
  UPDATE_STATUS: "bg-cyan-50 text-cyan-700",
};

const fmtCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

const PAGE_SIZE = 10;

interface AgentDashboardTabProps {
  onOpenConversation?: (conversationId: string) => void;
}

export function AgentDashboardTab({ onOpenConversation }: AgentDashboardTabProps) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/agent/dashboard").then((r) => r.json()),
      fetch("/api/agent/decisions?limit=50").then((r) => r.json()),
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

  const filteredDecisions = useMemo(() => {
    if (actionFilter === "all") return decisions;
    return decisions.filter((d) => d.action === actionFilter);
  }, [decisions, actionFilter]);

  const totalPages = Math.ceil(filteredDecisions.length / PAGE_SIZE);
  const safeCurrentPage = Math.min(page, Math.max(1, totalPages));
  const paginatedDecisions = filteredDecisions.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  const actionFilterOptions = useMemo(() => {
    const opts: { key: string; label: string; count?: number }[] = [
      { key: "all", label: "Todas" },
    ];
    if (dashboard?.actionBreakdown) {
      dashboard.actionBreakdown.forEach((ab) => {
        opts.push({
          key: ab.action,
          label: actionLabels[ab.action] || ab.action,
          count: ab.count,
        });
      });
    }
    return opts;
  }, [dashboard]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <KpiSkeleton count={4} />
        <div className="flex gap-6 border-b border-gray-200 pb-0">
          <Skeleton className="h-5 w-32 mb-3" />
          <Skeleton className="h-5 w-28 mb-3" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status badge */}
      <div className="flex justify-end">
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
              dashboard?.agentEnabled
                ? "bg-green-500 animate-pulse"
                : "bg-gray-400"
            )}
          />
          {dashboard?.agentEnabled ? "Ativo" : "Desativado"}
        </div>
      </div>

      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<Brain className="h-4 w-4" />}
            title="Decisoes Hoje"
            value={String(dashboard.decisionsToday)}
            subtitle={`${dashboard.decisions7d} nos ultimos 7 dias`}
            className="animate-in stagger-1"
          />
          <MetricCard
            icon={<Send className="h-4 w-4" />}
            title="Mensagens Enviadas"
            value={String(dashboard.messagesSent)}
            subtitle={`${dashboard.messagesQueued} na fila`}
            className="animate-in stagger-2"
          />
          <MetricCard
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Escalacoes Ativas"
            value={String(dashboard.escalationsActive)}
            subtitle={`${dashboard.escalationsTotal} total`}
            variant={dashboard.escalationsActive > 0 ? "danger" : "default"}
            className="animate-in stagger-3"
          />
          <MetricCard
            icon={<TrendingUp className="h-4 w-4" />}
            title="Confianca Media"
            value={`${(dashboard.avgConfidence * 100).toFixed(0)}%`}
            subtitle={`${dashboard.conversationsOpen} conversas abertas`}
            className="animate-in stagger-4"
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" onValueChange={() => setPage(1)}>
        <TabsList>
          <TabsTrigger value="overview">Decisoes Recentes</TabsTrigger>
          <TabsTrigger value="escalations">
            Escalacoes ({escalations.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Decisions */}
        <TabsContent value="overview">
          <div className="space-y-4">
            <FilterPillGroup
              options={actionFilterOptions}
              value={actionFilter}
              onChange={(v) => {
                setActionFilter(v);
                setPage(1);
              }}
            />

            {filteredDecisions.length === 0 ? (
              <FilterEmptyState
                message="Nenhuma decisao encontrada para o filtro selecionado."
                suggestion="Tente selecionar outra acao ou aguarde novas decisoes do agente."
                icon={<Bot className="h-6 w-6 text-gray-400" />}
                onClear={
                  actionFilter !== "all"
                    ? () => setActionFilter("all")
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {paginatedDecisions.map((dec) => (
                  <div
                    key={dec.id}
                    className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-xs font-medium",
                            actionColors[dec.action] || "bg-gray-100"
                          )}
                        >
                          {actionLabels[dec.action] || dec.action}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                          Confianca: {(dec.confidence * 100).toFixed(0)}%
                          <span className="inline-block w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <span
                              className="block h-full rounded-full bg-primary/70"
                              style={{ width: `${(dec.confidence * 100).toFixed(0)}%` }}
                            />
                          </span>
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
                        className="text-sm font-medium text-gray-900 hover:text-primary transition-colors"
                      >
                        {dec.customer.name}
                      </Link>
                      {dec.charge && (
                        <span className="text-xs text-gray-400 ml-2">
                          {dec.charge.description} —{" "}
                          {fmtCurrency(dec.charge.amountCents)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mt-1">
                      {dec.reasoning}
                    </p>

                    {dec.outputMessage && (
                      <div className="mt-2 p-2.5 bg-gray-50 rounded-xl text-xs text-gray-600 border-l-2 border-primary/30">
                        {dec.outputMessage.slice(0, 200)}
                        {dec.outputMessage.length > 200 ? "..." : ""}
                      </div>
                    )}
                  </div>
                ))}

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <Pagination
                    currentPage={safeCurrentPage}
                    totalPages={totalPages}
                    totalItems={filteredDecisions.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Escalations */}
        <TabsContent value="escalations">
          <div className="space-y-3">
            {escalations.length === 0 ? (
              <FilterEmptyState
                message="Nenhuma escalacao ativa."
                suggestion="O agente escalara automaticamente conversas que precisem de atencao humana."
                icon={<AlertTriangle className="h-6 w-6 text-gray-400" />}
              />
            ) : (
              escalations.map((esc) => (
                <div
                  key={esc.id}
                  className="bg-white rounded-2xl border border-red-100 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/crm/${esc.customer.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-primary transition-colors"
                      >
                        {esc.customer.name}
                      </Link>
                      <span className="text-xs text-gray-400 ml-2">
                        {esc.channel}
                      </span>
                    </div>
                    <button
                      onClick={() => onOpenConversation?.(esc.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors"
                    >
                      Abrir no Inbox <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  {esc.agentDecisions[0] && (
                    <div className="mt-2">
                      {esc.agentDecisions[0].escalationReason && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 mr-2">
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
                    <div className="mt-2 p-2.5 bg-gray-50 rounded-xl text-xs text-gray-600">
                      Ultima mensagem: {esc.messages[0].content.slice(0, 150)}
                      {esc.messages[0].content.length > 150 ? "..." : ""}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
