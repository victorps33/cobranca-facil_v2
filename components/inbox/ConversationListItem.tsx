"use client";

import { cn } from "@/lib/cn";
import { CONVERSATION_STATUS_DOT_COLORS } from "@/lib/utils";
import { Bot, User as UserIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConversationListItemProps {
  conversation: {
    id: string;
    channel: string;
    status: string;
    lastMessageAt: string;
    customer: { name: string };
    assignedTo?: { name: string } | null;
    messages: { content: string; sender: string; createdAt: string }[];
  };
  isSelected: boolean;
  isUnread: boolean;
  onClick: () => void;
}


export function ConversationListItem({
  conversation,
  isSelected,
  isUnread,
  onClick,
}: ConversationListItemProps) {
  const lastMsg = conversation.messages[0];
  const preview = lastMsg?.content?.slice(0, 80) || "Sem mensagens";
  const senderIsAI = lastMsg?.sender === "AI";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-3 border-b border-gray-50 transition-colors hover:bg-gray-50",
        isSelected && "bg-primary/5 border-l-2 border-l-primary",
        isUnread && !isSelected && "bg-blue-50/50"
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar initials + status dot */}
        <div className="relative flex-shrink-0 mt-0.5">
          <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-500">
              {conversation.customer.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
              CONVERSATION_STATUS_DOT_COLORS[conversation.status] || "bg-gray-300"
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span
              className={cn(
                "text-sm truncate",
                isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"
              )}
            >
              {conversation.customer.name}
            </span>
            <span className="text-[10px] text-gray-400 flex-shrink-0">
              {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                addSuffix: false,
                locale: ptBR,
              })}
            </span>
          </div>

          <p className="text-xs text-gray-500 truncate mt-0.5">
            {senderIsAI && (
              <Bot className="inline h-3 w-3 mr-1 text-primary" />
            )}
            {preview}
          </p>

          {/* Assigned to */}
          {conversation.assignedTo && (
            <div className="flex items-center gap-1 mt-1">
              <UserIcon className="h-2.5 w-2.5 text-gray-400" />
              <span className="text-[10px] text-gray-400">
                {conversation.assignedTo.name}
              </span>
            </div>
          )}
        </div>

        {/* Unread indicator */}
        {isUnread && (
          <span className="flex-shrink-0 h-2 w-2 rounded-full bg-primary mt-2" />
        )}
      </div>
    </button>
  );
}
