"use client";

import { cn } from "@/lib/cn";
import {
  Mail,
  MessageSquare,
  Smartphone,
  UserPlus,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
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

const channelLabel: Record<string, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
};

const statusLabel: Record<string, string> = {
  ABERTA: "Aberta",
  PENDENTE_IA: "Pendente IA",
  PENDENTE_HUMANO: "Pendente Humano",
  RESOLVIDA: "Resolvida",
};

const statusColors: Record<string, string> = {
  ABERTA: "text-green-700 bg-green-50",
  PENDENTE_IA: "text-yellow-700 bg-yellow-50",
  PENDENTE_HUMANO: "text-red-700 bg-red-50",
  RESOLVIDA: "text-gray-500 bg-gray-50",
};

export function ConversationHeader({
  conversation,
  onStatusChange,
  onToggleSidePanel,
  showSidePanel,
}: ConversationHeaderProps) {
  const ChannelIcon = channelIcon[conversation.channel] || Mail;

  return (
    <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 bg-white flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {conversation.customer.name}
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ChannelIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-gray-400">
            {channelLabel[conversation.channel]}
          </span>
        </div>
        <select
          value={conversation.status}
          onChange={(e) => onStatusChange(e.target.value)}
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer",
            statusColors[conversation.status]
          )}
        >
          <option value="ABERTA">Aberta</option>
          <option value="PENDENTE_HUMANO">Pendente Humano</option>
          <option value="RESOLVIDA">Resolvida</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        {conversation.status !== "RESOLVIDA" && (
          <button
            onClick={() => onStatusChange("RESOLVIDA")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
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
            className={cn("h-4 w-4 transition-transform", showSidePanel && "rotate-180")}
          />
        </button>
      </div>
    </div>
  );
}
