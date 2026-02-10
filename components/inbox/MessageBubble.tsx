"use client";

import { cn } from "@/lib/cn";
import { Bot, User, Lock } from "lucide-react";
import { format } from "date-fns";

interface MessageBubbleProps {
  message: {
    id: string;
    sender: string;
    content: string;
    createdAt: string;
    isInternal: boolean;
    senderUser?: { name: string } | null;
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isCustomer = message.sender === "CUSTOMER";
  const isAI = message.sender === "AI";
  const isSystem = message.sender === "SYSTEM";
  const isAgent = message.sender === "AGENT";

  if (isSystem || message.isInternal) {
    return (
      <div className="flex justify-center my-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-500">
          <Lock className="h-3 w-3" />
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-2 mb-3",
        isCustomer ? "justify-start" : "justify-end"
      )}
    >
      {isCustomer && (
        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-gray-500" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5",
          isCustomer
            ? "bg-gray-100 text-gray-900 rounded-bl-md"
            : isAI
              ? "bg-primary/10 text-gray-900 rounded-br-md border border-primary/20"
              : "bg-primary text-white rounded-br-md"
        )}
      >
        {isAI && (
          <div className="flex items-center gap-1 mb-1">
            <Bot className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-medium text-primary">
              Resposta automática
            </span>
          </div>
        )}
        {isAgent && message.senderUser && (
          <div className="mb-1">
            <span className="text-[10px] font-medium text-white/80">
              {message.senderUser.name}
            </span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <p
          className={cn(
            "text-[10px] mt-1",
            isCustomer ? "text-gray-400" : isAI ? "text-gray-400" : "text-white/60"
          )}
        >
          {format(new Date(message.createdAt), "HH:mm")}
        </p>
      </div>

      {!isCustomer && isAI && (
        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      {!isCustomer && isAgent && (
        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-white" />
        </div>
      )}
    </div>
  );
}
