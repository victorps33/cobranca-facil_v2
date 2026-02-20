"use client";

import { FilterPillGroup } from "@/components/ui/filter-pills";
import { SearchBar } from "@/components/ui/search-bar";

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
      <SearchBar
        value={search}
        onValueChange={onSearchChange}
        placeholder="Buscar conversas…"
        size="sm"
      />

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
