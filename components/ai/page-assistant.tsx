"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import {
  Sparkles,
  Send,
  X,
  Loader2,
  MessageSquare,
  ChevronUp,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface PageAssistantProps {
  pageContext: string;
  pageName: string;
  suggestions?: string[];
}

const defaultSuggestions: Record<string, string[]> = {
  apuracao: [
    "Resumo da apuração atual",
    "Há ajustes pendentes?",
    "Comparar com mês anterior",
  ],
  emissao: [
    "Melhor dia para emitir",
    "Franqueados com NF pendente",
    "Otimizar forma de pagamento",
  ],
  dividas: [
    "Casos mais críticos",
    "Sugerir ação para recuperação",
    "Histórico de contatos",
  ],
  cobrancas: [
    "Cobranças vencendo hoje",
    "Taxa de conversão atual",
    "Sugestões de melhoria",
  ],
  reguas: [
    "Efetividade da régua atual",
    "Sugerir otimizações",
    "Melhores práticas",
  ],
  clientes: [
    "Clientes com risco alto",
    "Novos clientes do mês",
    "Análise de perfil",
  ],
};

export function PageAssistant({ pageContext, pageName, suggestions }: PageAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pageSuggestions = suggestions || defaultSuggestions[pageContext] || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), pageContext }),
      });

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply || "Desculpe, não consegui processar sua pergunta.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Desculpe, ocorreu um erro. Tente novamente.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 px-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-[transform,box-shadow] flex items-center gap-3 z-50"
      >
        <Sparkles className="h-5 w-5" />
        <span className="font-medium">Pergunte à Júlia</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Júlia</h3>
            <p className="text-white/70 text-xs">Assistente de {pageName}</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="h-[300px] overflow-y-auto p-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
              <MessageSquare className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-gray-900 font-medium text-sm mb-1">Como posso ajudar?</p>
            <p className="text-xs text-gray-500 mb-4">
              Pergunte sobre {pageName.toLowerCase()} ou escolha uma sugestão
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {pageSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => sendMessage(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2",
                  message.role === "user"
                    ? "bg-primary text-white"
                    : "bg-gray-50 text-gray-900"
                )}
              >
                <div
                  className="text-sm whitespace-pre-wrap [&_strong]:font-semibold [&_ul]:my-1 [&_li]:my-0.5 [&_li]:ml-3"
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
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 rounded-2xl px-3 py-2 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              <span className="text-xs text-gray-500">Analisando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte algo…"
            aria-label="Perguntar ao assistente"
            disabled={loading}
            className="flex-1 h-10 px-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="h-10 w-10 flex items-center justify-center bg-primary text-white rounded-xl hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
