"use client";

import { cn } from "@/lib/cn";
import { Search, Mail, MessageSquare, Smartphone, X } from "lucide-react";

interface InboxFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  channelFilter: string | null;
  onChannelFilterChange: (value: string | null) => void;
  statusFilter: string | null;
  onStatusFilterChange: (value: string | null) => void;
}

const channelOptions = [
  { value: "EMAIL", label: "Email", icon: Mail },
  { value: "WHATSAPP", label: "WhatsApp", icon: MessageSquare },
  { value: "SMS", label: "SMS", icon: Smartphone },
];

const statusOptions = [
  { value: "ABERTA", label: "Abertas" },
  { value: "PENDENTE_IA", label: "Pendente IA" },
  { value: "PENDENTE_HUMANO", label: "Pendente Humano" },
  { value: "RESOLVIDA", label: "Resolvidas" },
];

export function InboxFilters({
  search,
  onSearchChange,
  channelFilter,
  onChannelFilterChange,
  statusFilter,
  onStatusFilterChange,
}: InboxFiltersProps) {
  return (
    <div className="p-3 space-y-2 border-b border-gray-100">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar conversas..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Channel pills */}
      <div className="flex flex-wrap gap-1.5">
        {channelOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() =>
              onChannelFilterChange(
                channelFilter === opt.value ? null : opt.value
              )
            }
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
              channelFilter === opt.value
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <opt.icon className="h-3 w-3" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() =>
              onStatusFilterChange(
                statusFilter === opt.value ? null : opt.value
              )
            }
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
              statusFilter === opt.value
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
