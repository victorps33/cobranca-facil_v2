"use client";

import { cn } from "@/lib/cn";
import { Mail, MessageSquare, Smartphone, Bot, User as UserIcon } from "lucide-react";
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

const channelIcon: Record<string, typeof Mail> = {
  EMAIL: Mail,
  WHATSAPP: MessageSquare,
  SMS: Smartphone,
};

const statusColors: Record<string, string> = {
  ABERTA: "bg-green-400",
  PENDENTE_IA: "bg-yellow-400",
  PENDENTE_HUMANO: "bg-red-400",
  RESOLVIDA: "bg-gray-300",
};

export function ConversationListItem({
  conversation,
  isSelected,
  isUnread,
  onClick,
}: ConversationListItemProps) {
  const ChannelIcon = channelIcon[conversation.channel] || Mail;
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
        {/* Channel icon + status dot */}
        <div className="relative flex-shrink-0 mt-0.5">
          <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ChannelIcon className="h-4 w-4 text-gray-500" />
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
              statusColors[conversation.status] || "bg-gray-300"
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
