"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import {
  CHANNEL_LABELS,
  CONVERSATION_STATUS_LABELS,
  CONVERSATION_STATUS_COLORS,
} from "@/lib/utils";
import {
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

interface ConversationHeaderProps {
  conversation: {
    id: string;
    channel: string;
    status: string;
    customer: { id: string; name: string };
    assignedTo?: { id: string; name: string } | null;
  };
  onStatusChange: (status: string) => void;
  onToggleSidePanel: () => void;
  showSidePanel: boolean;
}

const channelIcon: Record<string, typeof Mail> = {
  EMAIL: Mail,
  WHATSAPP: MessageSquare,
  SMS: Smartphone,
};

const statusTransitions: Record<string, string[]> = {
  ABERTA: ["PENDENTE_HUMANO", "RESOLVIDA"],
  PENDENTE_IA: ["ABERTA", "PENDENTE_HUMANO", "RESOLVIDA"],
  PENDENTE_HUMANO: ["ABERTA", "RESOLVIDA"],
  RESOLVIDA: ["ABERTA"],
};

export function ConversationHeader({
  conversation,
  onStatusChange,
  onToggleSidePanel,
  showSidePanel,
}: ConversationHeaderProps) {
  const ChannelIcon = channelIcon[conversation.channel] || Mail;
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  const transitions = statusTransitions[conversation.status] ?? [];

  return (
    <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 bg-white flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {conversation.customer.name}
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ChannelIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-gray-400">
            {CHANNEL_LABELS[conversation.channel]}
          </span>
        </div>

        {/* Status dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpenMenu(!openMenu)}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
              CONVERSATION_STATUS_COLORS[conversation.status]
            )}
          >
            {CONVERSATION_STATUS_LABELS[conversation.status]}
            {transitions.length > 0 && <ChevronDown className="h-3 w-3" />}
          </button>
          {openMenu && transitions.length > 0 && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
              {transitions.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    onStatusChange(status);
                    setOpenMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      CONVERSATION_STATUS_COLORS[status]?.split(" ")[0]
                    )}
                  />
                  {CONVERSATION_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {conversation.status !== "RESOLVIDA" && (
          <button
            onClick={() => onStatusChange("RESOLVIDA")}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Resolver
          </button>
        )}
        <button
          onClick={onToggleSidePanel}
          className={cn(
            "inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
            showSidePanel
              ? "bg-primary/10 text-primary"
              : "text-gray-400 hover:bg-gray-100"
          )}
          title="Info do cliente"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              showSidePanel && "rotate-180"
            )}
          />
        </button>
      </div>
    </div>
  );
}
