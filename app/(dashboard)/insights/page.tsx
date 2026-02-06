"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/cn";
import {
  Sparkles,
  Send,
  TrendingDown,
  TrendingUp,
  MapPin,
  Shield,
  AlertTriangle,
  BarChart3,
  Target,
  Loader2,
  Trash2,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const filters = [
  { id: "all", label: "Todos" },
  { id: "financial", label: "Saúde Financeira" },
  { id: "performance", label: "Performance" },
  { id: "regional", label: "Regional" },
  { id: "recommendations", label: "Recomendações" },
];

const insightCards = [
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

export default function InsightsPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filteredCards = activeFilter === "all"
    ? insightCards
    : insightCards.filter((card) => card.category === activeFilter);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), pageContext: "insights" }),
      });

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply || "Desculpe, não consegui processar sua pergunta no momento.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (question: string) => {
    sendMessage(question);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = () => {
    setMessages([initialMessage]);
  };

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
              Escolha um tema abaixo ou faça uma pergunta sobre sua rede. Vou analisar os dados e trazer insights acionáveis.
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

      {/* Insight Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {filteredCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.question)}
              className="bg-white rounded-2xl border border-gray-100 p-6 text-left hover:border-gray-200 hover:shadow-md transition-[border-color,box-shadow] group"
            >
              <div className="flex items-start gap-4">
                <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", card.bgColor)}>
                  <Icon className={cn("h-6 w-6", card.color)} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-[#F85B00] transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{card.subtitle}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Chat Section */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Conversa com Júlia</h3>
            <p className="text-sm text-gray-500">Analista de dados da rede</p>
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
                <div
                  className={cn(
                    "text-sm whitespace-pre-wrap",
                    message.role === "assistant" && "prose prose-sm prose-gray max-w-none [&_strong]:font-semibold [&_ul]:my-2 [&_li]:my-1"
                  )}
                  dangerouslySetInnerHTML={{
                    __html: message.content
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                      .replace(/- (.*)/g, "<li>$1</li>")
                      .replace(/(<li>.*<\/li>)+/g, "<ul>$&</ul>")
                      .replace(/\n/g, "<br/>"),
                  }}
                />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                <span className="text-sm text-gray-500">Júlia está analisando...</span>
              </div>
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
