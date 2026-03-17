"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, Loader2, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { fetchWithTenant } from "@/lib/fetch-with-tenant";
import { OmieConfigDialog } from "./omie-config-dialog";
import { ContaAzulConfigDialog } from "./conta-azul-config-dialog";

interface ERPConfigState {
  provider: string;
  lastSyncAt: string | null;
  syncEnabled: boolean;
  hasOmieCredentials?: boolean;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export function ERPConfigSection() {
  const [config, setConfig] = useState<ERPConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [omieDialogOpen, setOmieDialogOpen] = useState(false);
  const [contaAzulDialogOpen, setContaAzulDialogOpen] = useState(false);

  const fetchConfig = useCallback(() => {
    fetchWithTenant("/api/erp-config")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch(() => setConfig({ provider: "NONE", lastSyncAt: null, syncEnabled: false }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(true);
    try {
      const res = await fetchWithTenant("/api/integrations/sync", { method: "POST" });
      const data = await res.json();
      console.log("[Sync] Response:", data);
      if (!res.ok) throw new Error(data.error || "Sync failed");
      const boletoInfo = data.boletosFound ? ` Boletos: ${data.boletosFound} encontrados.` : "";
      const errorInfo = data.errorDetails?.length ? `\n⚠ ${data.errorDetails.join("; ")}` : "";
      toast({
        title: "Sincronizado",
        description: `Clientes: ${data.customersCreated} novos, ${data.customersUpdated} atualizados. Cobranças: ${data.chargesCreated} novas, ${data.chargesUpdated} atualizadas.${boletoInfo}${errorInfo}`,
      });
      fetchConfig();
    } catch (err) {
      toast({
        title: "Erro na sincronização",
        description: err instanceof Error ? err.message : "Falha ao sincronizar.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisconnecting(true);
    try {
      const res = await fetchWithTenant("/api/erp-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "NONE" }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "ERP desconectado", description: "Integração removida." });
      fetchConfig();
    } catch {
      toast({ title: "Erro", description: "Falha ao desconectar.", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">ERP / Sistema de Gestão</span>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const activeProvider = config?.provider || "NONE";
  const isOmieActive = activeProvider === "OMIE";
  const isContaAzulActive = activeProvider === "CONTA_AZUL";
  const hasActive = isOmieActive || isContaAzulActive;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">ERP / Sistema de Gestão</span>
        </div>
        <p className="text-xs text-gray-500 mt-1 ml-6">
          Conecte seu ERP para sincronizar clientes, cobranças e notas fiscais.
        </p>
      </div>

      {/* Omie row — clickable */}
      <button
        type="button"
        onClick={() => setOmieDialogOpen(true)}
        disabled={hasActive && !isOmieActive}
        className={`w-full rounded-xl border p-4 flex items-center justify-between transition-colors text-left ${
          isOmieActive
            ? "bg-emerald-50 border-emerald-200"
            : hasActive
              ? "bg-white border-gray-200 opacity-50 cursor-not-allowed"
              : "bg-white border-gray-200 hover:bg-gray-50 cursor-pointer"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg">
            📊
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Omie</div>
            {isOmieActive ? (
              <div className="text-xs text-emerald-700">
                ✓ Configurado
                {config?.lastSyncAt && ` — Última sync ${timeAgo(config.lastSyncAt)}`}
              </div>
            ) : (
              <div className="text-xs text-gray-500">Credenciais via API Key</div>
            )}
          </div>
        </div>
        {isOmieActive ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              {disconnecting ? "..." : "Desconectar"}
            </button>
          </div>
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Conta Azul row — clickable */}
      <button
        type="button"
        onClick={() => setContaAzulDialogOpen(true)}
        disabled={hasActive && !isContaAzulActive}
        className={`w-full rounded-xl border p-4 flex items-center justify-between transition-colors text-left ${
          isContaAzulActive
            ? "bg-emerald-50 border-emerald-200"
            : hasActive
              ? "bg-white border-gray-200 opacity-50 cursor-not-allowed"
              : "bg-white border-gray-200 hover:bg-gray-50 cursor-pointer"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-lg">
            🔵
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Conta Azul</div>
            {isContaAzulActive ? (
              <div className="text-xs text-emerald-700">
                ✓ Conectado
                {config?.lastSyncAt && ` — Última sync ${timeAgo(config.lastSyncAt)}`}
              </div>
            ) : (
              <div className="text-xs text-gray-500">OAuth2</div>
            )}
          </div>
        </div>
        {isContaAzulActive ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              {disconnecting ? "..." : "Desconectar"}
            </button>
          </div>
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      <OmieConfigDialog
        open={omieDialogOpen}
        onOpenChange={setOmieDialogOpen}
        onSaved={fetchConfig}
      />
      <ContaAzulConfigDialog
        open={contaAzulDialogOpen}
        onOpenChange={setContaAzulDialogOpen}
      />
    </div>
  );
}
