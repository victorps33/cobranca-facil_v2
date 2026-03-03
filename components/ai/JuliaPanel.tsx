"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  Sparkles,
  Send,
  TrendingDown,
  MapPin,
  Shield,
  Target,
  Loader2,
  Clock,
  History,
  ChevronRight,
  AlertTriangle,
  BarChart3,
  MessageSquare,
  Lightbulb,
  CheckCircle2,
  Zap,
  ListRestart,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { ActionPlan, type Action } from "@/components/insights/ActionPlan";
import { renderSafeMarkdown } from "@/lib/sanitize-markdown";

// ── Types ──

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: Action[];
  chartKey?: string | null;
}

interface StoredConversation {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  messages: Message[];
  timestamp: number;
}

// ── Constants ──

const HISTORY_KEY = "julia_conversations_v1";

const promptPresets = [
  { id: "prioridade", label: "Quem cobrar primeiro?", question: "Quem eu devo cobrar primeiro? Analise por urgência e valor.", icon: Target, color: "text-red-500", bgColor: "bg-red-50" },
  { id: "mudancas", label: "O que mudou este mês?", question: "O que mudou na minha rede este mês? Liste melhorias e pioras.", icon: TrendingDown, color: "text-amber-500", bgColor: "bg-amber-50" },
  { id: "comparar", label: "Comparar regiões", question: "Compare a inadimplência e recuperação por região da minha rede.", icon: BarChart3, color: "text-blue-500", bgColor: "bg-blue-50" },
  { id: "previsao", label: "Previsão de recebimento", question: "Qual a previsão de recebimento para os próximos 30 dias?", icon: Lightbulb, color: "text-emerald-500", bgColor: "bg-emerald-50" },
  { id: "inadimplencia", label: "Mapa da inadimplência", question: "Onde está concentrada a inadimplência na minha rede? Analise por perfil de risco e região.", icon: MapPin, color: "text-red-500", bgColor: "bg-red-50" },
  { id: "efetividade", label: "Efetividade da cobrança", question: "Qual a efetividade das minhas cobranças? Analise o PMR médio por perfil de risco.", icon: Shield, color: "text-blue-500", bgColor: "bg-blue-50" },
];

interface JuliaAlert {
  id: string;
  type: "critical" | "warning" | "success";
  title: string;
  description: string;
  question: string;
}

const alertIconMap = {
  critical: AlertTriangle,
  warning: Clock,
  success: CheckCircle2,
};

// ── Chart Configs ──

// Chart configs are populated dynamically from real data when available
const chartConfigs: Record<string, { title: string; type: "bar" | "pie" | "line" | "area"; data: any[]; colors?: string[]; keys?: string[] }> = {};

function detectChart(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("inadimpl") && (lower.includes("região") || lower.includes("region") || lower.includes("concentr"))) return "inadimplencia_regiao";
  if (lower.includes("pmr") || lower.includes("efetividade")) return "pmr_perfil";
  if ((lower.includes("piora") || lower.includes("tendência") || lower.includes("mudou")) && !lower.includes("previsão")) return "tendencia_recebimento";
  if (lower.includes("risco") && lower.includes("financ")) return "status_franqueados";
  if (lower.includes("previsão") || lower.includes("próximos") || lower.includes("cenário")) return "previsao_recebimento";
  if (lower.includes("cobrar primeiro") || lower.includes("prioridad")) return "inadimplencia_regiao";
  if (lower.includes("comparar") || lower.includes("compar")) return "inadimplencia_regiao";
  return null;
}

// ── Helpers ──

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}


function parseFullResponse(text: string): { cleanText: string; suggestions: string[]; actions: Action[] } {
  let remaining = text;
  let cleanText = text;
  const suggestions: string[] = [];
  const actions: Action[] = [];
  const sugIdx = remaining.indexOf("<<SUGESTÕES>>");
  const actIdx = remaining.indexOf("<<AÇÕES>>");
  const firstMarker = Math.min(sugIdx !== -1 ? sugIdx : Infinity, actIdx !== -1 ? actIdx : Infinity);
  if (firstMarker !== Infinity) cleanText = remaining.slice(0, firstMarker).trimEnd();
  if (sugIdx !== -1) {
    const afterSug = remaining.slice(sugIdx + "<<SUGESTÕES>>".length);
    const nextMarker = afterSug.indexOf("<<AÇÕES>>");
    const sugBlock = nextMarker !== -1 ? afterSug.slice(0, nextMarker) : afterSug;
    sugBlock.trim().split("\n").map((s) => s.trim()).filter((s) => s.length > 0).forEach((s) => suggestions.push(s));
  }
  if (actIdx !== -1) {
    const actBlock = remaining.slice(actIdx + "<<AÇÕES>>".length).trim();
    actBlock.split("\n").map((line) => line.trim()).filter((line) => line.includes("|")).forEach((line, i) => {
      const parts = line.split("|");
      if (parts.length >= 4) {
        actions.push({ id: `action-${Date.now()}-${i}`, type: parts[0] as Action["type"], param: parts[1], label: parts[2], description: parts[3], status: "pending" });
      }
    });
  }
  return { cleanText, suggestions, actions };
}

function saveConversation(messages: Message[]) {
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length === 0) return;
  const title = userMsgs[0].content.slice(0, 60);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.content);
  const preview = lastAssistant?.content.slice(0, 100) || "";
  const conv: StoredConversation = { id: Date.now().toString(), title, preview, messageCount: messages.length, messages: messages.map((m) => ({ ...m, timestamp: m.timestamp })), timestamp: Date.now() };
  try {
    const existing: StoredConversation[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    existing.unshift(conv);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(existing.slice(0, 20)));
  } catch {}
}

function loadConversations(): StoredConversation[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

// ── Chart Artifact ──

function ChartArtifact({ chartKey }: { chartKey: string }) {
  const config = chartConfigs[chartKey];
  if (!config) return null;
  const fmtBRL = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
        <h4 className="text-xs font-semibold text-gray-900">{config.title}</h4>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        {config.type === "bar" ? (
          <BarChart data={config.data}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />{(config.keys || []).map((key, i) => (<Bar key={key} dataKey={key} fill={config.colors?.[i] || "#8b5cf6"} radius={[6, 6, 0, 0]} />))}</BarChart>
        ) : config.type === "pie" ? (
          <PieChart><Pie data={config.data} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, value }: any) => `${name}: ${value}`}>{config.data.map((entry: any, i: number) => (<Cell key={i} fill={entry.fill || config.colors?.[i] || "#8b5cf6"} />))}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart>
        ) : config.type === "line" ? (
          <LineChart data={config.data}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />{(config.keys || []).map((key, i) => (<Line key={key} type="monotone" dataKey={key} stroke={config.colors?.[i] || "#8b5cf6"} strokeWidth={2} dot={{ r: 3 }} />))}</LineChart>
        ) : (
          <AreaChart data={config.data}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tickFormatter={fmtBRL} tick={{ fontSize: 9 }} /><Tooltip formatter={(val: number) => fmtBRL(val)} />{(config.keys || []).map((key, i) => (<Area key={key} type="monotone" dataKey={key} stroke={config.colors?.[i] || "#8b5cf6"} fill={config.colors?.[i] || "#8b5cf6"} fillOpacity={i === 0 ? 0.15 : 0.08} strokeWidth={2} />))}<Legend wrapperStyle={{ fontSize: 10 }} /></AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Panel Component ──

interface JuliaPanelProps {
  open: boolean;
  onClose: () => void;
}

export function JuliaPanel({ open, onClose }: JuliaPanelProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [activeChart, setActiveChart] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);
  const [lastSentText, setLastSentText] = useState<string>("");
  const [juliaAlerts, setJuliaAlerts] = useState<JuliaAlert[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize greeting + fetch real alerts
  useEffect(() => {
    const greeting = getGreeting();
    setMessages([{
      id: "initial",
      role: "assistant",
      content: `${greeting}! Sou a **Júlia**, sua analista IA. Escolha um tema ou me pergunte qualquer coisa.`,
      timestamp: new Date(),
    }]);
    setConversations(loadConversations());

    // Fetch real alerts from the database
    const tenantId = typeof window !== "undefined" ? localStorage.getItem("active_franqueadora_id") : null;
    const alertHeaders: Record<string, string> = {};
    if (tenantId) alertHeaders["x-franqueadora-id"] = tenantId;
    fetch("/api/julia/alerts", { headers: alertHeaders })
      .then((r) => r.json())
      .then((data) => {
        if (data.alerts && Array.isArray(data.alerts)) {
          setJuliaAlerts(data.alerts);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    setLastSentText(text.trim());
    setLastErrorMessage(null);

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: text.trim(), timestamp: new Date() };
    const historyMessages = [...messages, userMessage].filter((m) => m.id !== "initial").map((m) => ({ role: m.role, content: m.content }));
    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = { id: assistantId, role: "assistant", content: "", timestamp: new Date() };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setLoading(true);
    setSuggestions([]);
    setActions([]);

    const chartKey = detectChart(text);
    setActiveChart(chartKey);

    if (abortRef.current) abortRef.current.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const tenantId = typeof window !== "undefined" ? localStorage.getItem("active_franqueadora_id") : null;
      const chatHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (tenantId) chatHeaders["x-franqueadora-id"] = tenantId;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: chatHeaders,
        body: JSON.stringify({ messages: historyMessages, stream: true, pageContext: "insights" }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        let errorMsg: string;
        if (res.status === 429) {
          errorMsg = "Você atingiu o limite de perguntas. Aguarde alguns minutos.";
        } else if (res.status === 503 || res.status === 500) {
          errorMsg = "A Júlia está temporariamente indisponível.";
        } else {
          errorMsg = "Ocorreu um erro. Tente novamente.";
        }
        setLastErrorMessage(errorMsg);
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: errorMsg } : m));
        setLoading(false);
        abortRef.current = null;
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
              const { cleanText } = parseFullResponse(accumulated);
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: cleanText } : m)));
            }
          } catch {}
        }
      }

      const { cleanText, suggestions: newSuggestions, actions: newActions } = parseFullResponse(accumulated);
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: cleanText, actions: newActions, chartKey } : m));
      if (newSuggestions.length > 0) setSuggestions(newSuggestions);
      if (newActions.length > 0) setActions(newActions);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const errorMsg = "Ocorreu um erro. Tente novamente.";
      setLastErrorMessage(errorMsg);
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: errorMsg } : m));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [loading, messages]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };

  const clearChat = () => {
    if (messages.filter((m) => m.role === "user").length > 0) {
      saveConversation(messages);
      setConversations(loadConversations());
    }
    if (abortRef.current) abortRef.current.abort();
    const greeting = getGreeting();
    setMessages([{ id: "initial", role: "assistant", content: `${greeting}! Sou a **Júlia**, sua analista IA. Escolha um tema ou me pergunte qualquer coisa.`, timestamp: new Date() }]);
    setSuggestions([]);
    setActions([]);
    setActiveChart(null);
  };

  const loadConversation = (conv: StoredConversation) => {
    setMessages(conv.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })));
    setSuggestions([]);
    setActions([]);
    setActiveChart(null);
    setActiveTab("chat");
  };

  const handleAction = (action: Action) => {
    if (action.type === "navigate") { router.push(action.param); onClose(); }
    else { setActions((prev) => prev.map((a) => (a.id === action.id ? { ...a, status: "completed" as const } : a))); }
  };

  const isInitialState = messages.length <= 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ease-out pointer-events-none",
          open ? "opacity-100" : "opacity-0"
        )}
      >
      <div
        className={cn(
          "w-full max-w-2xl h-[85vh] bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col transition-all duration-300 ease-out",
          open ? "scale-100 opacity-100 pointer-events-auto" : "scale-95 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn("h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center", loading && "animate-pulse")}>
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Júlia</h3>
              <div className="flex items-center gap-1.5">
                {loading ? (
                  <><span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" /><span className="text-[11px] text-blue-600 font-medium">Analisando...</span></>
                ) : (
                  <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="text-[11px] text-gray-400">Analista IA</span></>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Tab toggles */}
            <button
              onClick={() => setActiveTab("chat")}
              className={cn("px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors", activeTab === "chat" ? "bg-blue-50 text-blue-700" : "text-gray-400 hover:text-gray-600")}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn("px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors", activeTab === "history" ? "bg-blue-50 text-blue-700" : "text-gray-400 hover:text-gray-600")}
            >
              <span className="flex items-center gap-1">
                <History className="h-3 w-3" />
                {conversations.length > 0 && <span className="text-[10px]">{conversations.length}</span>}
              </span>
            </button>
            {messages.length > 1 && (
              <button onClick={clearChat} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Nova conversa">
                <ListRestart className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {activeTab === "chat" ? (
          <>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.map((message) => (
                <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[90%] rounded-2xl px-3.5 py-2.5", message.role === "user" ? "bg-primary text-white" : "bg-gray-50 text-gray-900")}>
                    {message.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className={cn("h-4 w-4 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center", loading && message.content === "" && "animate-pulse")}>
                          <Sparkles className="h-2 w-2 text-white" />
                        </div>
                        <span className="text-[10px] font-medium text-gray-400">Júlia</span>
                        {loading && message.content !== "" && message.id === messages[messages.length - 1]?.id && (
                          <span className="flex gap-0.5 ml-1">
                            <span className="h-1 w-1 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
                            <span className="h-1 w-1 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
                            <span className="h-1 w-1 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
                          </span>
                        )}
                      </div>
                    )}
                    {message.role === "assistant" && message.content === "" && loading ? (
                      <div className="flex items-center gap-2 py-1">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
                        </div>
                        <span className="text-[11px] text-gray-400">Pensando...</span>
                      </div>
                    ) : (
                      <div className={cn("text-[13px] leading-relaxed", message.role === "assistant" && "[&_strong]:font-semibold [&_ul]:my-1.5 [&_li]:my-0.5 [&_li]:ml-1")} dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(message.content) }} />
                    )}
                  </div>
                </div>
              ))}

              {/* Retry button on error */}
              {lastErrorMessage && !loading && (
                <div className="flex justify-center">
                  <button
                    onClick={() => { if (lastSentText) sendMessage(lastSentText); }}
                    className="px-3 py-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100 flex items-center gap-1.5"
                  >
                    <ListRestart className="h-3 w-3" />
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Follow-up suggestions */}
              {suggestions.length > 0 && !loading && (
                <div className="flex flex-wrap gap-1.5 pl-6">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)} className="px-2.5 py-1 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors border border-blue-100">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Chart artifact inline */}
              {activeChart && !loading && <ChartArtifact chartKey={activeChart} />}

              {/* Action plan inline */}
              {actions.length > 0 && !loading && <ActionPlan actions={actions} onExecute={handleAction} />}

              {/* Prompt presets (initial state) */}
              {isInitialState && !loading && (
                <div className="pt-2">
                  {/* Alerts */}
                  {juliaAlerts.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
                      <Zap className="h-2.5 w-2.5" />
                      Alertas
                    </p>
                    {juliaAlerts.map((alert) => {
                      const Icon = alertIconMap[alert.type] || AlertTriangle;
                      return (
                        <div key={alert.id} className={cn("p-2.5 rounded-xl border transition-all cursor-pointer group",
                          alert.type === "critical" && "border-red-200 bg-red-50/50 hover:bg-red-50",
                          alert.type === "warning" && "border-amber-200 bg-amber-50/50 hover:bg-amber-50",
                          alert.type === "success" && "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50",
                        )} onClick={() => sendMessage(alert.question)}>
                          <div className="flex items-start gap-2.5">
                            <Icon className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0",
                              alert.type === "critical" && "text-red-500",
                              alert.type === "warning" && "text-amber-500",
                              alert.type === "success" && "text-emerald-500",
                            )} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-gray-900">{alert.title}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">{alert.description}</p>
                            </div>
                            <ChevronRight className="h-3 w-3 text-gray-300 group-hover:text-gray-500 mt-0.5 flex-shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}

                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 pl-1">Perguntas rápidas</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {promptPresets.slice(0, 4).map((preset) => {
                      const Icon = preset.icon;
                      return (
                        <button key={preset.id} onClick={() => sendMessage(preset.question)} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left group">
                          <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0", preset.bgColor)}>
                            <Icon className={cn("h-3.5 w-3.5", preset.color)} />
                          </div>
                          <span className="text-[11px] font-medium text-gray-700 group-hover:text-blue-700 line-clamp-2">{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="border-t border-gray-100 shrink-0">
              {!isInitialState && (
                <div className="px-4 pt-2 flex items-center gap-1 overflow-x-auto">
                  <button onClick={clearChat} disabled={loading} className="whitespace-nowrap px-2.5 py-1 text-[10px] font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors border border-gray-100 flex-shrink-0 disabled:opacity-50 flex items-center gap-1">
                    <ListRestart className="h-3 w-3" />
                    Voltar ao início
                  </button>
                  {promptPresets.slice(0, 2).map((p) => (
                    <button key={p.id} onClick={() => sendMessage(p.question)} disabled={loading} className="whitespace-nowrap px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors border border-gray-100 flex-shrink-0 disabled:opacity-50">{p.label}</button>
                  ))}
                </div>
              )}
              <form onSubmit={handleSubmit} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Pergunte sobre sua rede…"
                    disabled={loading}
                    className="flex-1 h-10 px-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-100 outline-none transition-colors"
                  />
                  <button type="submit" disabled={!input.trim() || loading} className="h-10 w-10 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </form>
              <p className="text-[10px] text-gray-400 text-center pb-2">
                Dados processados de forma segura e anônima
              </p>
            </div>
          </>
        ) : (
          /* History tab */
          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
            {conversations.length === 0 ? (
              <div className="text-center py-16">
                <History className="h-8 w-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Nenhuma conversa salva</p>
                <p className="text-[11px] text-gray-300 mt-1">Conversas são salvas ao iniciar uma nova</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button key={conv.id} onClick={() => loadConversation(conv)} className="w-full p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left group">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-4 w-4 text-gray-300 mt-0.5 flex-shrink-0 group-hover:text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-blue-700">{conv.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{conv.preview}</p>
                      <p className="text-[10px] text-gray-300 mt-1">{new Date(conv.timestamp).toLocaleDateString("pt-BR")} • {conv.messageCount} msgs</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      </div>
    </>
  );
}
