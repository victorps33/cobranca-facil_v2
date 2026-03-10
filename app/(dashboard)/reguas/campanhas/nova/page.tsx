"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { getFranqueadoraHeaders } from "@/lib/fetch-with-tenant";
import { renderSafeMarkdown } from "@/lib/sanitize-markdown";
import {
  Send,
  Loader2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

/* ── Types ── */

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface CampaignDraft {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  maxCashDiscount?: number;
  maxInstallments?: number;
  monthlyInterestRate?: number;
  minInstallmentCents?: number;
  targetFilters?: Record<string, unknown>;
  steps?: { trigger: string; offsetDays: number; channel: string; template: string }[];
  status?: string;
}

/* ── Parsing ── */

function parseCampaignResponse(text: string): {
  cleanText: string;
  suggestions: string[];
  campaignUpdate: Partial<CampaignDraft> | null;
  confirmed: boolean;
} {
  let remaining = text;
  const suggestions: string[] = [];
  let campaignUpdate: Partial<CampaignDraft> | null = null;
  let confirmed = false;

  // Extract CAMPAIGN_CONFIRM
  if (remaining.includes("<<CAMPAIGN_CONFIRM>>")) {
    confirmed = true;
    remaining = remaining.replace("<<CAMPAIGN_CONFIRM>>", "").trim();
  }

  // Extract CAMPAIGN_UPDATE
  const updateStart = remaining.indexOf("<<CAMPAIGN_UPDATE>>");
  const updateEnd = remaining.indexOf("<<END>>");
  if (updateStart !== -1 && updateEnd !== -1) {
    const jsonStr = remaining.slice(updateStart + "<<CAMPAIGN_UPDATE>>".length, updateEnd).trim();
    try {
      campaignUpdate = JSON.parse(jsonStr);
    } catch {}
    remaining = remaining.slice(0, updateStart) + remaining.slice(updateEnd + "<<END>>".length);
  }

  // Extract suggestions
  const sugIdx = remaining.indexOf("<<SUGESTÕES>>");
  let cleanText = remaining;
  if (sugIdx !== -1) {
    cleanText = remaining.slice(0, sugIdx).trimEnd();
    const sugBlock = remaining.slice(sugIdx + "<<SUGESTÕES>>".length).trim();
    sugBlock.split("\n").map((s) => s.trim()).filter((s) => s.length > 0).forEach((s) => suggestions.push(s));
  } else {
    cleanText = remaining.trim();
  }

  return { cleanText, suggestions, campaignUpdate, confirmed };
}

/* ── Page ── */

export default function NovaCampanhaPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [draft, setDraft] = useState<CampaignDraft>({});
  const [creating, setCreating] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send initial greeting on mount
  useEffect(() => {
    sendMessage("Crie campanhas de negociação baseadas nos dados atuais.", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create campaign
  const createCampaign = useCallback(async () => {
    if (!draft.name || !draft.startDate || !draft.endDate) {
      const missing = [
        !draft.name && "nome",
        !draft.startDate && "data de início",
        !draft.endDate && "data de término",
      ].filter(Boolean).join(", ");
      setMessages((prev) => [
        ...prev,
        {
          id: `warn-${Date.now()}`,
          role: "assistant",
          content: `**Dados incompletos para criar a campanha.** Faltam: ${missing}. Continue a conversa para definir esses campos.`,
          timestamp: new Date(),
        },
      ]);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/negotiation-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getFranqueadoraHeaders() },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          startDate: draft.startDate,
          endDate: draft.endDate,
          maxCashDiscount: draft.maxCashDiscount ?? 0.10,
          maxInstallments: draft.maxInstallments ?? 6,
          monthlyInterestRate: draft.monthlyInterestRate ?? 0.02,
          minInstallmentCents: draft.minInstallmentCents ?? 5000,
          targetFilters: draft.targetFilters,
        }),
      });

      if (res.ok) {
        await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `success-${Date.now()}`,
            role: "assistant",
            content: `**Campanha "${draft.name}" criada com sucesso!** 🎉\n\nVocê pode visualizá-la na aba Campanhas da página de Réguas.`,
            timestamp: new Date(),
          },
        ]);
        setSuggestions(["Ver campanhas", "Criar outra campanha"]);
      } else {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `**Erro ao criar campanha:** ${err.error || "Tente novamente."}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "**Erro de conexão.** Tente novamente.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setCreating(false);
    }
  }, [draft]);

  // Trigger campaign creation after draft state settles
  useEffect(() => {
    if (pendingConfirm) {
      setPendingConfirm(false);
      createCampaign();
    }
  }, [pendingConfirm, createCampaign]);

  // Send message
  const sendMessage = useCallback(
    async (text: string, isSystem = false) => {
      if (!text.trim()) return;
      if (loading) return;

      // Handle navigation suggestions
      if (text === "Ver campanhas") {
        router.push("/reguas?tab=campanhas");
        return;
      }
      if (text === "Criar outra campanha") {
        setMessages([]);
        setDraft({});
        setSuggestions([]);
        sendMessage("Crie campanhas de negociação baseadas nos dados atuais.", true);
        return;
      }

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      if (!isSystem) {
        setMessages((prev) => [...prev, userMsg, assistantMsg]);
      } else {
        setMessages((prev) => [...prev, assistantMsg]);
      }
      setInput("");
      setLoading(true);
      setSuggestions([]);

      if (abortRef.current) abortRef.current.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const tenantHeaders = getFranqueadoraHeaders();
        const chatHeaders: Record<string, string> = { "Content-Type": "application/json" };
        for (const [k, v] of Object.entries(tenantHeaders)) {
          if (typeof v === "string") chatHeaders[k] = v;
        }

        const historyMessages = [...messages, userMsg]
          .filter((m) => m.content)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: chatHeaders,
          body: JSON.stringify({
            messages: historyMessages,
            stream: true,
            pageContext: "campaign-creation",
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errorMsg = res.status === 429
            ? "Limite de mensagens atingido. Aguarde alguns minutos."
            : "Erro ao conectar com a AI. Tente novamente.";
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: errorMsg } : m)));
          setLoading(false);
          return;
        }

        if (!res.body) throw new Error("Stream failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") break;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.text) {
                accumulated += parsed.text;
                const { cleanText } = parseCampaignResponse(accumulated);
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: cleanText } : m))
                );
              }
            } catch {}
          }
        }

        // Parse final response
        const { cleanText, suggestions: newSuggestions, campaignUpdate, confirmed } =
          parseCampaignResponse(accumulated);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: cleanText } : m))
        );
        if (newSuggestions.length > 0) setSuggestions(newSuggestions);

        // Apply campaign update
        if (campaignUpdate) {
          setDraft((prev) => ({ ...prev, ...campaignUpdate }));
        }

        // Auto-create on confirmation
        if (confirmed) {
          setPendingConfirm(true);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "Erro de conexão. Tente novamente." } : m
          )
        );
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [loading, messages, createCampaign, router]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6 lg:-m-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
        <button
          onClick={() => router.push("/reguas")}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Nova Campanha</h1>
          <p className="text-xs text-gray-400">Converse com a AI para criar sua campanha</p>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 min-h-0">
        {/* Chat (left) */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                    msg.role === "user"
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-700"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div
                      className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5"
                      dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(msg.content || "…") }}
                    />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start">
                <div className="bg-gray-50 rounded-2xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && !loading && (
            <div className="px-6 pb-2 flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-gray-100 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Descreva sua campanha..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 placeholder:text-gray-400"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Preview (right) — hidden on mobile */}
        <div className="hidden lg:block w-[400px] shrink-0 overflow-y-auto p-6 bg-gray-50/50">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-gray-400" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Preview</h2>
          </div>
          <CampaignPreview draft={draft} creating={creating} />
        </div>
      </div>
    </div>
  );
}

/* ── Campaign Preview ── */

function CampaignPreview({ draft, creating }: { draft: CampaignDraft; creating: boolean }) {
  const hasData = draft.name || draft.startDate || draft.maxCashDiscount;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Sparkles className="h-8 w-8 text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">Defina sua campanha na conversa ao lado</p>
        <p className="text-xs text-gray-300 mt-1">O preview será atualizado em tempo real</p>
      </div>
    );
  }

  const start = draft.startDate
    ? new Date(draft.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "—";
  const end = draft.endDate
    ? new Date(draft.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "—";

  return (
    <div className={cn(
      "rounded-2xl border border-gray-200 bg-white overflow-hidden transition-all duration-300",
      creating && "opacity-60"
    )}>
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{draft.name || "Sem nome"}</h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
            Rascunho
          </span>
        </div>
        {draft.description && (
          <p className="text-xs text-gray-500 mt-1">{draft.description}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{start} — {end}</p>
      </div>

      {/* Commercial terms */}
      <div className="px-5 pb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
        {draft.maxCashDiscount !== undefined && (
          <span>Desconto até {(draft.maxCashDiscount * 100).toFixed(0)}%</span>
        )}
        {draft.maxInstallments !== undefined && <span>Até {draft.maxInstallments}x</span>}
        {draft.monthlyInterestRate !== undefined && (
          <span>Juros {(draft.monthlyInterestRate * 100).toFixed(1)}% a.m.</span>
        )}
        {draft.minInstallmentCents !== undefined && (
          <span>Parcela mín. R$ {(draft.minInstallmentCents / 100).toFixed(0)}</span>
        )}
      </div>

      {/* Target filters */}
      {draft.targetFilters && Object.keys(draft.targetFilters).length > 0 && (
        <div className="px-5 pb-3 border-t border-gray-50 pt-3">
          <p className="text-[10px] text-gray-400 font-medium mb-1">Público-alvo</p>
          <div className="flex flex-wrap gap-1.5">
            {draft.targetFilters.minDaysOverdue !== undefined && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-600">
                Atraso ≥ {String(draft.targetFilters.minDaysOverdue)} dias
              </span>
            )}
            {draft.targetFilters.minValueCents !== undefined && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-600">
                Valor ≥ R$ {(Number(draft.targetFilters.minValueCents) / 100).toFixed(0)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Steps */}
      {draft.steps && draft.steps.length > 0 && (
        <div className="px-5 pb-4 border-t border-gray-50 pt-3">
          <p className="text-[10px] text-gray-400 font-medium mb-2">Etapas ({draft.steps.length})</p>
          <div className="space-y-1.5">
            {draft.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="w-10 text-gray-400 font-mono">
                  {step.trigger === "BEFORE_DUE" ? `D-${step.offsetDays}` : step.trigger === "ON_DUE" ? "D0" : `D+${step.offsetDays}`}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">
                  {step.channel}
                </span>
                <span className="text-gray-500 truncate">{step.template.slice(0, 40)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {creating && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Criando campanha...
        </div>
      )}
    </div>
  );
}
