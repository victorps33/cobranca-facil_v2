"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import {
  Sparkles,
  Send,
  Trash2,
  Loader2,
  MessageSquare,
  ArrowRight,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const suggestedQuestions = [
  "Quais dívidas merecem atenção hoje?",
  "O que mudou na receita nos últimos 30 dias?",
  "Quais clientes têm maior risco de atraso?",
  "Sugira ajustes na régua para pagadores duvidosos",
];

export function MiaChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const res = await fetch("/api/mia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
      });

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.replyMarkdown || "Desculpe, não consegui processar sua pergunta.",
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

  const clearChat = () => {
    setMessages([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Mia</h3>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-gray-500">Online</span>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            title="Limpar conversa"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-gray-900 font-medium mb-1">Pergunte à Mia</p>
            <p className="text-sm text-gray-500 max-w-[240px]">
              Insights sobre cobrança, inadimplência e performance do seu negócio
            </p>
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
                  "max-w-[85%] rounded-2xl px-4 py-3",
                  message.role === "user"
                    ? "bg-primary text-white"
                    : "bg-gray-50 text-gray-900"
                )}
              >
                {message.role === "assistant" ? (
                  <div
                    className="prose prose-sm prose-gray max-w-none
                      [&_p]:my-1 [&_ul]:my-2 [&_li]:my-0.5
                      [&_strong]:text-gray-900 [&_strong]:font-semibold
                      [&_a]:text-primary [&_a]:no-underline [&_a:hover]:underline"
                    dangerouslySetInnerHTML={{
                      __html: message.content
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/- (.*)/g, "<li>$1</li>")
                        .replace(/(<li>.*<\/li>)+/g, "<ul>$&</ul>")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 rounded-2xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="px-6 pb-2">
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.slice(0, 2).map((question, index) => (
              <button
                key={index}
                onClick={() => sendMessage(question)}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors truncate max-w-full"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-gray-50"
      >
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte à Mia…"
            aria-label="Perguntar à Mia"
            disabled={loading}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-lg bg-primary text-white disabled:opacity-50 transition-colors hover:bg-primary-hover"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
