"use client";

import { InboxFilters } from "./InboxFilters";
import { ConversationListItem } from "./ConversationListItem";
import { Loader2 } from "lucide-react";

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
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-sm text-gray-500">Nenhuma conversa encontrada</p>
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
