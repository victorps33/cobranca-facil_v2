"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { cn } from "@/lib/cn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, FileText } from "lucide-react";
import {
  formatDateTime,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_STATUS_COLORS,
} from "@/lib/utils";

interface NotificationLog {
  id: string;
  channel: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
  renderedMessage: string;
  charge: {
    id: string;
    description: string;
    customer: {
      name: string;
    };
  };
  step: {
    trigger: string;
    offsetDays: number;
    rule: {
      name: string;
    };
  };
}

export default function LogsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchLogs = async () => {
    try {
      let url = "/api/logs?";
      if (channelFilter !== "all") url += `channel=${channelFilter}&`;
      if (statusFilter !== "all") url += `status=${statusFilter}&`;

      const res = await fetch(url);
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [channelFilter, statusFilter]);

  const formatTrigger = (step: NotificationLog["step"]) => {
    if (step.trigger === "BEFORE_DUE") return `D-${step.offsetDays}`;
    if (step.trigger === "ON_DUE") return "D0";
    if (step.trigger === "AFTER_DUE") return `D+${step.offsetDays}`;
    return "";
  };

  const openLogDetail = (log: NotificationLog) => {
    setSelectedLog(log);
    setDialogOpen(true);
  };

  function clearFilters() {
    setChannelFilter("all");
    setStatusFilter("all");
  }

  const hasActiveFilters = channelFilter !== "all" || statusFilter !== "all";

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#85ace6]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs de Notificações"
        subtitle="Histórico de envios automáticos da régua"
      />

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {[
            { key: "all", label: "Todos canais" },
            { key: "EMAIL", label: "E-mail" },
            { key: "SMS", label: "SMS" },
            { key: "WHATSAPP", label: "WhatsApp" },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => setChannelFilter(c.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                channelFilter === c.key
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {[
            { key: "all", label: "Todos status" },
            { key: "SENT", label: "Enviado" },
            { key: "FAILED", label: "Falhou" },
            { key: "SKIPPED", label: "Ignorado" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                statusFilter === s.key
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table or Empty State ── */}
      {logs.length === 0 ? (
        <FilterEmptyState
          message={
            hasActiveFilters
              ? "Nenhum log encontrado para os filtros selecionados."
              : "Nenhum envio registrado ainda."
          }
          icon={<FileText className="h-6 w-6 text-gray-400" />}
          onClear={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Logs de notificações">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500">Data</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Canal</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Cliente</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Cobrança</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Régua</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Gatilho</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                      {formatDateTime(new Date(log.sentAt || log.scheduledFor))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2.5 py-1 text-xs font-medium rounded-full", CHANNEL_COLORS[log.channel])}>
                        {CHANNEL_LABELS[log.channel]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2.5 py-1 text-xs font-medium rounded-full", NOTIFICATION_STATUS_COLORS[log.status])}>
                        {NOTIFICATION_STATUS_LABELS[log.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{log.charge.customer.name}</td>
                    <td className="px-4 py-3">
                      <Link href={`/cobrancas/${log.charge.id}`} className="text-sm text-[#85ace6] hover:underline">
                        {log.charge.description}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{log.step.rule.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-bold text-gray-600">{formatTrigger(log.step)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openLogDetail(log)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {logs.length} registros
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Notificação</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Canal</p>
                  <span className={cn("px-2.5 py-1 text-xs font-medium rounded-full", CHANNEL_COLORS[selectedLog.channel])}>
                    {CHANNEL_LABELS[selectedLog.channel]}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Status</p>
                  <span className={cn("px-2.5 py-1 text-xs font-medium rounded-full", NOTIFICATION_STATUS_COLORS[selectedLog.status])}>
                    {NOTIFICATION_STATUS_LABELS[selectedLog.status]}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Agendado para</p>
                  <p className="font-medium text-gray-900">{formatDateTime(new Date(selectedLog.scheduledFor))}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Enviado em</p>
                  <p className="font-medium text-gray-900">
                    {selectedLog.sentAt ? formatDateTime(new Date(selectedLog.sentAt)) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Cliente</p>
                  <p className="font-medium text-gray-900">{selectedLog.charge.customer.name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Cobrança</p>
                  <Link href={`/cobrancas/${selectedLog.charge.id}`} className="text-sm text-[#85ace6] hover:underline font-medium">
                    {selectedLog.charge.description}
                  </Link>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-2">Mensagem Renderizada</p>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm whitespace-pre-wrap text-gray-700">
                  {selectedLog.renderedMessage}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
