"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Send, Lock } from "lucide-react";

interface MessageComposerProps {
  onSend: (content: string, isInternal: boolean) => void;
  disabled?: boolean;
}

export function MessageComposer({ onSend, disabled }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || disabled) return;
    onSend(content.trim(), isInternal);
    setContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 p-3 bg-white"
    >
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setIsInternal(!isInternal)}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
            isInternal
              ? "bg-amber-100 text-amber-700"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          )}
        >
          <Lock className="h-3 w-3" />
          {isInternal ? "Nota interna" : "Resposta"}
        </button>
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isInternal
              ? "Escrever nota interna..."
              : "Escrever resposta..."
          }
          rows={1}
          disabled={disabled}
          className={cn(
            "flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30 focus-visible:border-secondary",
            isInternal ? "border-amber-200 bg-amber-50" : "border-gray-200"
          )}
          style={{ minHeight: "40px", maxHeight: "120px" }}
        />
        <button
          type="submit"
          disabled={!content.trim() || disabled}
          className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
