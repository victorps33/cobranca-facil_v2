"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/cn";
import {
  Sparkles,
  Send,
  TrendingDown,
  MapPin,
  Shield,
  Target,
  Loader2,
  Trash2,
  RefreshCw,
} from "lucide-react";

// ── Types ──

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface InsightCard {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof MapPin;
  color: string;
  bgColor: string;
  category: string;
  question: string;
  analysis: string | null;
  loading: boolean;
}

// ── Static config ──

const filters = [
  { id: "all", label: "Todos" },
  { id: "financial", label: "Saúde Financeira" },
  { id: "performance", label: "Performance" },
];

const defaultCards: Omit<InsightCard, "analysis" | "loading">[] = [
  {
    id: "inadimplencia",
    title: "Onde está concentrada a inadimplência?",
    subtitle: "Análise por perfil de risco e região",
    icon: MapPin,
    color: "text-red-500",
    bgColor: "bg-red-50",
    category: "financial",
    question: "Onde está concentrada a inadimplência na minha rede? Analise por perfil de risco e região.",
  },
  {
    id: "piorando",
    title: "Quais franqueados estão piorando?",
    subtitle: "Tendência de piora nos últimos meses",
    icon: TrendingDown,
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    category: "performance",
    question: "Quais franqueados estão com tendência de piora nos últimos meses? Liste os principais e sugira ações.",
  },
  {
    id: "efetividade",
    title: "Qual a efetividade da cobrança?",
    subtitle: "PMR médio por perfil de risco",
    icon: Target,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    category: "performance",
    question: "Qual a efetividade das minhas cobranças? Analise o PMR médio por perfil de risco.",
  },
  {
    id: "risco",
    title: "Qual o risco financeiro total?",
    subtitle: "Exposição e cenários de recuperação",
    icon: Shield,
    color: "text-emerald-500",
    bgColor: "bg-emerald-50",
    category: "financial",
    question: "Qual o risco financeiro total da minha rede? Apresente a exposição e cenários de recuperação.",
  },
];

const initialMessage: Message = {
  id: "initial",
  role: "assistant",
  content: "Olá! Sou a Júlia, sua analista de dados da rede Menlo. Estou aqui para simplificar a gestão da sua rede. Escolha uma pergunta acima ou me conte sua dúvida — vou trazer insights que fazem a diferença.",
  timestamp: new Date(),
};

// ── Helpers ──

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/- (.*)/g, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)+/g, "<ul>$&</ul>")
    .replace(/\n/g, "<br/>");
}

/** Parse <<SUGESTÕES>> section from completed AI text */
function parseSuggestions(text: string): { cleanText: string; suggestions: string[] } {
  const marker = "<<SUGESTÕES>>";
  const idx = text.indexOf(marker);
  if (idx === -1) return { cleanText: text, suggestions: [] };

  const cleanText = text.slice(0, idx).trimEnd();
  const suggestionsBlock = text.slice(idx + marker.length).trim();
  const suggestions = suggestionsBlock
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return { cleanText, suggestions };
}

// ── Component ──

export default function InsightsPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [cards, setCards] = useState<InsightCard[]>(
    defaultCards.map((c) => ({ ...c, analysis: null, loading: false }))
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasFetchedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Pre-load analyses on mount (non-streaming) ──

  const fetchAnalysis = useCallback(async (cardId: string, question: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, loading: true } : c))
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, pageContext: "insights" }),
      });

      const data = await res.json();

      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, analysis: data.reply || null, loading: false }
            : c
        )
      );
    } catch {
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, loading: false } : c))
      );
    }
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    defaultCards.forEach((card) => {
      fetchAnalysis(card.id, card.question);
    });
  }, [fetchAnalysis]);

  // ── Chat (streaming) ──

  const filteredCards = activeFilter === "all"
    ? cards
    : cards.filter((card) => card.category === activeFilter);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    // Build conversation history for memory (skip initial greeting)
    const historyMessages = [...messages, userMessage]
      .filter((m) => m.id !== "initial")
      .map((m) => ({ role: m.role, content: m.content }));

    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setLoading(true);
    setSuggestions([]);

    // Abort any previous stream
    if (abortRef.current) abortRef.current.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyMessages,
          stream: true,
          pageContext: "insights",
        }),
        signal: abortController.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE lines
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

              // Update message content progressively — strip suggestions marker from display
              const { cleanText } = parseSuggestions(accumulated);

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: cleanText } : m
                )
              );
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      // Stream done — parse final suggestions
      const { cleanText, suggestions: newSuggestions } = parseSuggestions(accumulated);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: cleanText } : m
        )
      );

      if (newSuggestions.length > 0) {
        setSuggestions(newSuggestions);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente." }
            : m
        )
      );
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleCardClick = (card: InsightCard) => {
    if (card.analysis) {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: card.question,
        timestamp: new Date(),
      };
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: card.analysis,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setSuggestions([]);
    } else {
      sendMessage(card.question);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([initialMessage]);
    setSuggestions([]);
  };

  const refreshCard = (cardId: string) => {
    const card = defaultCards.find((c) => c.id === cardId);
    if (card) {
      fetchAnalysis(card.id, card.question);
    }
  };

  // ── Expanded card state ──

  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Insights"
        subtitle="Análises inteligentes da Júlia"
      />

      {/* Agent Card */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Júlia — Agente Menlo IA</h2>
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">IA</span>
            </div>
            <p className="text-white/80 mt-1 text-sm">
              Análises pré-prontas da sua rede, atualizadas em tempo real. Clique para expandir ou faça uma pergunta personalizada.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              activeFilter === filter.id
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Insight Cards — pre-loaded analyses */}
      <div className="grid gap-4 sm:grid-cols-2">
        {filteredCards.map((card) => {
          const Icon = card.icon;
          const isExpanded = expandedCard === card.id;

          return (
            <div
              key={card.id}
              className={cn(
                "bg-white rounded-2xl border border-gray-100 overflow-hidden transition-[border-color,box-shadow]",
                isExpanded ? "sm:col-span-2 shadow-md border-gray-200" : "hover:border-gray-200 hover:shadow-md"
              )}
            >
              {/* Card Header — always visible */}
              <button
                onClick={() => setExpandedCard(isExpanded ? null : card.id)}
                className="w-full p-6 text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0", card.bgColor)}>
                    <Icon className={cn("h-6 w-6", card.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 group-hover:text-[#F85B00] transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{card.subtitle}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {card.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                    ) : card.analysis ? (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-50 text-emerald-600">
                        Pronto
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-400">
                        —
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded Analysis */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {card.loading ? (
                    <div className="flex items-center justify-center gap-2 py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                      <span className="text-sm text-gray-500">Júlia está analisando...</span>
                    </div>
                  ) : card.analysis ? (
                    <div className="px-6 py-5">
                      {/* AI badge */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Sparkles className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-xs font-medium text-gray-500">Análise da Júlia</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); refreshCard(card.id); }}
                            className="p-1.5 text-gray-400 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-colors"
                            title="Atualizar análise"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCardClick(card); }}
                            className="px-3 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded-full transition-colors"
                          >
                            Enviar para o chat
                          </button>
                        </div>
                      </div>

                      {/* Analysis content */}
                      <div
                        className="text-sm text-gray-700 leading-relaxed prose prose-sm prose-gray max-w-none [&_strong]:font-semibold [&_ul]:my-2 [&_li]:my-1"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(card.analysis) }}
                      />
                    </div>
                  ) : (
                    <div className="px-6 py-8 text-center">
                      <p className="text-sm text-gray-400">Não foi possível carregar a análise.</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); refreshCard(card.id); }}
                        className="mt-2 text-xs font-medium text-violet-600 hover:text-violet-700"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chat Section */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Conversa com Júlia</h3>
            <p className="text-sm text-gray-500">Faça perguntas livres sobre sua rede</p>
          </div>
          {messages.length > 1 && (
            <button
              onClick={clearChat}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
              aria-label="Limpar conversa"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="h-[400px] overflow-y-auto p-6 space-y-4"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3",
                  message.role === "user"
                    ? "bg-[#F85B00] text-white"
                    : "bg-gray-50 text-gray-900"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-500">Júlia</span>
                  </div>
                )}
                {message.role === "assistant" && message.content === "" && loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                    <span className="text-sm text-gray-500">Analisando...</span>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "text-sm whitespace-pre-wrap",
                      message.role === "assistant" && "prose prose-sm prose-gray max-w-none [&_strong]:font-semibold [&_ul]:my-2 [&_li]:my-1"
                    )}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Follow-up suggestions */}
          {suggestions.length > 0 && !loading && (
            <div className="flex flex-wrap gap-2 pl-10">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(suggestion)}
                  className="px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-full transition-colors border border-violet-100"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-gray-50">
          <div className="flex items-center gap-3">
            <input
              type="text"
              name="message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre sua rede…"
              aria-label="Perguntar à assistente"
              disabled={loading}
              className="flex-1 h-12 px-4 bg-gray-50 border border-gray-100 rounded-xl text-sm focus-visible:border-[#85ace6] focus-visible:ring-2 focus-visible:ring-[#85ace6]/20 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Enviar mensagem"
              className="h-12 w-12 flex items-center justify-center bg-[#F85B00] text-white rounded-xl hover:bg-[#e05200] disabled:opacity-50 transition-colors"
            >
              <Send className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
