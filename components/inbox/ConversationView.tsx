"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { ConversationHeader } from "./ConversationHeader";
import { Loader2, MessageSquareOff } from "lucide-react";
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50">
        <div className="text-center">
          <MessageSquareOff className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Selecione uma conversa para visualizar
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const groups = groupMessagesByDate(conversation.messages);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <ConversationHeader
        conversation={conversation}
        onStatusChange={onStatusChange}
        onToggleSidePanel={onToggleSidePanel}
        showSidePanel={showSidePanel}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50/30">
        {groups.map((group) => (
          <div key={group.date}>
            <div className="flex items-center justify-center my-4">
              <span className="text-[10px] text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">
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
