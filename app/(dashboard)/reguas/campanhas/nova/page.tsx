"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { getFranqueadoraHeaders } from "@/lib/fetch-with-tenant";
import { renderSafeMarkdown } from "@/lib/sanitize-markdown";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Send,
  Loader2,
  ArrowLeft,
  Sparkles,
  Check,
  ExternalLink,
  CheckCircle2,
  Circle,
  PartyPopper,
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
    remaining = remaining.replace(/<<CAMPAIGN_CONFIRM>>/g, "");
  }

  // Extract all CAMPAIGN_UPDATE blocks (complete: has <<END>>)
  const updateRegex = /<<CAMPAIGN_UPDATE>>([\s\S]*?)<<END>>/g;
  let match;
  while ((match = updateRegex.exec(remaining)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as Partial<CampaignDraft>;
      campaignUpdate = Object.assign({}, campaignUpdate, parsed);
    } catch {}
  }
  remaining = remaining.replace(updateRegex, "");

  // Strip incomplete CAMPAIGN_UPDATE (started but <<END>> not yet arrived — streaming)
  const partialIdx = remaining.indexOf("<<CAMPAIGN_UPDATE>>");
  if (partialIdx !== -1) {
    remaining = remaining.slice(0, partialIdx);
  }

  // Extract suggestions
  const sugIdx = remaining.indexOf("<<SUGESTÕES>>");
  if (sugIdx !== -1) {
    const sugBlock = remaining.slice(sugIdx + "<<SUGESTÕES>>".length).trim();
    sugBlock
      .split("\n")
      .map((s) => s.replace(/<<[A-Z_]+>>/g, "").trim())
      .filter((s) => s.length > 0 && s.length < 60)
      .forEach((s) => suggestions.push(s));
    remaining = remaining.slice(0, sugIdx);
  }

  // Clean up any stray markers
  remaining = remaining
    .replace(/<<END>>/g, "")
    .replace(/<<SUGESTÕES>>/g, "")
    .replace(/<<CAMPAIGN_UPDATE>>/g, "")
    .replace(/<<CAMPAIGN_CONFIRM>>/g, "")
    .trim();

  return { cleanText: remaining, suggestions, campaignUpdate, confirmed };
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
  const [created, setCreated] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasData = !!(draft.name || draft.startDate || draft.maxCashDiscount);
  const canCreate = !!(draft.name && draft.startDate && draft.endDate);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send initial greeting on mount
  useEffect(() => {
    sendMessage("Crie campanhas de negociação baseadas nos dados atuais.", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create campaign (only called after explicit confirmation)
  const createCampaign = useCallback(async () => {
    if (!draft.name || !draft.startDate || !draft.endDate) return;
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
        setCreated(true);
        setMessages((prev) => [
          ...prev,
          {
            id: `success-${Date.now()}`,
            role: "assistant",
            content: `**Campanha "${draft.name}" criada com sucesso!**\n\nEla já está disponível na aba Campanhas.`,
            timestamp: new Date(),
          },
        ]);
        setSuggestions(["Ver campanhas criadas", "Criar outra campanha"]);
      } else {
        const errBody = await res.text();
        let errMsg = "Erro desconhecido";
        try {
          const parsed = JSON.parse(errBody);
          errMsg = parsed.error || errMsg;
        } catch {}
        console.error("Campaign creation error:", res.status, errBody);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `**Erro ao criar campanha:** ${errMsg}`,
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

  // Send message
  const sendMessage = useCallback(
    async (text: string, isSystem = false) => {
      if (!text.trim()) return;
      if (loading) return;

      // Handle navigation suggestions
      if (text === "Ver campanhas" || text === "Ver campanhas criadas") {
        router.push("/reguas?tab=campanhas");
        return;
      }
      if (text === "Criar outra campanha") {
        setMessages([]);
        setDraft({});
        setCreated(false);
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

        // When AI confirms, show confirmation dialog instead of auto-creating
        if (confirmed) {
          setShowConfirm(true);
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
    [loading, messages, router]
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/reguas?tab=campanhas")}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Nova Campanha</h1>
            <p className="text-xs text-gray-400">Converse com a AI para criar sua campanha</p>
          </div>
        </div>
        {/* Mobile preview toggle */}
        {hasData && (
          <button
            onClick={() => setShowMobilePreview(!showMobilePreview)}
            className="lg:hidden px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            {showMobilePreview ? "Ver chat" : "Ver preview"}
          </button>
        )}
      </div>

      {/* Split layout */}
      <div className="flex flex-1 min-h-0">
        {/* Chat (left) — hidden on mobile when preview is open */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 lg:border-r border-gray-100",
          showMobilePreview && "hidden lg:flex"
        )}>
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

          {/* Mobile floating CTA */}
          {!showMobilePreview && (
            <div className="lg:hidden px-6 pb-2">
              {created ? (
                <button
                  onClick={() => router.push("/reguas?tab=campanhas")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver campanhas criadas
                </button>
              ) : canCreate && !creating ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Criar campanha
                </button>
              ) : null}
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

        {/* Preview (right on desktop, full-screen toggle on mobile) */}
        <div className={cn(
          "w-full lg:w-[400px] shrink-0 overflow-y-auto p-6 bg-gray-50/50",
          showMobilePreview ? "block" : "hidden lg:block"
        )}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-gray-400" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Preview</h2>
          </div>
          <CampaignPreview
            draft={draft}
            creating={creating}
            created={created}
            onCreateCampaign={() => setShowConfirm(true)}
            onViewCampaigns={() => router.push("/reguas?tab=campanhas")}
          />
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Criar campanha?"
        description={`A campanha "${draft.name || ""}" será criada e ficará disponível para ativação na aba Campanhas.`}
        confirmLabel="Criar campanha"
        cancelLabel="Revisar"
        onConfirm={createCampaign}
      />
    </div>
  );
}

/* ── Progress Checklist ── */

function ProgressChecklist({ draft }: { draft: CampaignDraft }) {
  const fields = [
    { label: "Nome", done: !!draft.name },
    { label: "Período", done: !!(draft.startDate && draft.endDate) },
    { label: "Condições", done: draft.maxCashDiscount !== undefined || draft.maxInstallments !== undefined },
    { label: "Público-alvo", done: !!(draft.targetFilters && Object.keys(draft.targetFilters).length > 0) },
  ];

  const doneCount = fields.filter((f) => f.done).length;
  const allDone = doneCount === fields.length;

  return (
    <div className="px-5 py-3 border-t border-gray-50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-gray-400 font-medium">Progresso</p>
        <span className={cn(
          "text-[10px] font-semibold",
          allDone ? "text-emerald-600" : "text-gray-400"
        )}>
          {doneCount}/{fields.length}
        </span>
      </div>
      <div className="space-y-1">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center gap-2 text-[11px]">
            {f.done ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-3 w-3 text-gray-300 shrink-0" />
            )}
            <span className={f.done ? "text-gray-600" : "text-gray-400"}>{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Campaign Preview ── */

function CampaignPreview({
  draft,
  creating,
  created,
  onCreateCampaign,
  onViewCampaigns,
}: {
  draft: CampaignDraft;
  creating: boolean;
  created: boolean;
  onCreateCampaign: () => void;
  onViewCampaigns: () => void;
}) {
  const hasData = draft.name || draft.startDate || draft.maxCashDiscount;
  const canCreate = !!(draft.name && draft.startDate && draft.endDate);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Sparkles className="h-8 w-8 text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">Defina sua campanha na conversa ao lado</p>
        <p className="text-xs text-gray-300 mt-1">O preview será atualizado em tempo real</p>
      </div>
    );
  }

  // Success state
  if (created) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 overflow-hidden">
          <div className="flex flex-col items-center py-8 px-5 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <PartyPopper className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Campanha criada!</h3>
            <p className="text-xs text-gray-500">{draft.name}</p>
            <p className="text-xs text-gray-400 mt-1">
              {draft.startDate && new Date(draft.startDate).toLocaleDateString("pt-BR")} — {draft.endDate && new Date(draft.endDate).toLocaleDateString("pt-BR")}
            </p>
          </div>
          {/* Summary */}
          <div className="px-5 pb-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-emerald-700">
            {draft.maxCashDiscount !== undefined && (
              <span>Desconto até {(draft.maxCashDiscount * 100).toFixed(0)}%</span>
            )}
            {draft.maxInstallments !== undefined && <span>Até {draft.maxInstallments}x</span>}
          </div>
        </div>
        <button
          onClick={onViewCampaigns}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Ver campanhas criadas
        </button>
        <button
          onClick={() => window.location.reload()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-gray-700 text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Criar outra campanha
        </button>
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
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden transition-all duration-300">
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
                  Atraso &ge; {String(draft.targetFilters.minDaysOverdue)} dias
                </span>
              )}
              {draft.targetFilters.minValueCents !== undefined && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-600">
                  Valor &ge; R$ {(Number(draft.targetFilters.minValueCents) / 100).toFixed(0)}
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

        {/* Progress checklist */}
        <ProgressChecklist draft={draft} />

        {/* Creating state */}
        {creating && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Criando campanha...
          </div>
        )}
      </div>

      {/* Create button */}
      {canCreate && !creating && (
        <button
          onClick={onCreateCampaign}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Check className="h-4 w-4" />
          Criar campanha
        </button>
      )}
    </div>
  );
}
