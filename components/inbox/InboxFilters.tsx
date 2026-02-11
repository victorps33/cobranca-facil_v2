"use client";

import { FilterPillGroup } from "@/components/ui/filter-pills";
import { Search, X } from "lucide-react";

interface InboxFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  channelFilter: string | null;
  onChannelFilterChange: (value: string | null) => void;
  statusFilter: string | null;
  onStatusFilterChange: (value: string | null) => void;
}

const channelOptions = [
  { key: "all", label: "Todos" },
  { key: "EMAIL", label: "Email" },
  { key: "WHATSAPP", label: "WhatsApp" },
  { key: "SMS", label: "SMS" },
];

const statusOptions = [
  { key: "all", label: "Todos" },
  { key: "ABERTA", label: "Abertas" },
  { key: "PENDENTE_IA", label: "Pendente IA" },
  { key: "PENDENTE_HUMANO", label: "Pendente Humano" },
  { key: "RESOLVIDA", label: "Resolvidas" },
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
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-colors"
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
      <FilterPillGroup
        options={channelOptions}
        value={channelFilter || "all"}
        onChange={(v) => onChannelFilterChange(v === "all" ? null : v)}
      />

      {/* Status pills */}
      <FilterPillGroup
        options={statusOptions}
        value={statusFilter || "all"}
        onChange={(v) => onStatusFilterChange(v === "all" ? null : v)}
      />
    </div>
  );
}
