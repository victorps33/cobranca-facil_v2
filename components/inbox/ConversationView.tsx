"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { ConversationHeader } from "./ConversationHeader";
import { MessageSquareOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface Message {
  id: string;
  sender: string;
  content: string;
  createdAt: string;
  isInternal: boolean;
  senderUser?: { name: string } | null;
}

interface ConversationViewProps {
  conversation: {
    id: string;
    channel: string;
    status: string;
    customer: { id: string; name: string };
    assignedTo?: { id: string; name: string } | null;
    messages: Message[];
  } | null;
  isLoading: boolean;
  onSendMessage: (content: string, isInternal: boolean) => void;
  onStatusChange: (status: string) => void;
  onToggleSidePanel: () => void;
  showSidePanel: boolean;
}

function groupMessagesByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = "";

  for (const msg of messages) {
    const date = format(new Date(msg.createdAt), "yyyy-MM-dd");
    if (date !== currentDate) {
      currentDate = date;
      groups.push({ date, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }

  return groups;
}

export function ConversationView({
  conversation,
  isLoading,
  onSendMessage,
  onStatusChange,
  onToggleSidePanel,
  showSidePanel,
}: ConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [conversation?.messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50 min-h-0">
        <div className="text-center">
          <MessageSquareOff className="h-10 w-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">
            Selecione uma conversa para visualizar
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <div className="flex-1 px-4 py-3 bg-gray-50/30 space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-16 w-64 rounded-2xl rounded-tl-sm" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-12 w-48 rounded-2xl rounded-tl-sm" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-12 w-56 rounded-2xl rounded-tr-sm" />
          </div>
        </div>
      </div>
    );
  }

  const groups = groupMessagesByDate(conversation.messages);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <ConversationHeader
        conversation={conversation}
        onStatusChange={onStatusChange}
        onToggleSidePanel={onToggleSidePanel}
        showSidePanel={showSidePanel}
      />

      {/* Messages area — flex-1 with overflow scroll */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50/30 min-h-0"
      >
        {groups.map((group) => (
          <div key={group.date}>
            <div className="flex items-center justify-center my-4">
              <span className="text-[10px] text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                {format(new Date(group.date), "dd/MM/yyyy")}
              </span>
            </div>
            {group.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <MessageComposer
        onSend={onSendMessage}
        disabled={conversation.status === "RESOLVIDA"}
      />
    </div>
  );
}
