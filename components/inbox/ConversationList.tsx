"use client";

import { InboxFilters } from "./InboxFilters";
import { ConversationListItem } from "./ConversationListItem";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";

interface Conversation {
  id: string;
  channel: string;
  status: string;
  lastMessageAt: string;
  customer: { name: string };
  assignedTo?: { name: string } | null;
  messages: { content: string; sender: string; createdAt: string }[];
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  channelFilter: string | null;
  onChannelFilterChange: (value: string | null) => void;
  statusFilter: string | null;
  onStatusFilterChange: (value: string | null) => void;
  isLoading: boolean;
  unreadIds: Set<string>;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  channelFilter,
  onChannelFilterChange,
  statusFilter,
  onStatusFilterChange,
  isLoading,
  unreadIds,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full border-r border-gray-200 bg-white w-80 flex-shrink-0">
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900">Inbox</h2>
        {conversations.length > 0 && (
          <span className="ml-2 text-xs text-gray-400">
            {conversations.length}
          </span>
        )}
      </div>

      <InboxFilters
        search={search}
        onSearchChange={onSearchChange}
        channelFilter={channelFilter}
        onChannelFilterChange={onChannelFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-gray-50 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8">
            <FilterEmptyState
              message="Nenhuma conversa encontrada."
              suggestion="Tente ajustar os filtros ou aguarde novas mensagens."
              icon={<MessageSquare className="h-6 w-6 text-gray-400" />}
              onClear={
                search || channelFilter || statusFilter
                  ? () => {
                      onSearchChange("");
                      onChannelFilterChange(null);
                      onStatusFilterChange(null);
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              isUnread={unreadIds.has(conv.id)}
              onClick={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
