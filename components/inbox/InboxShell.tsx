"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ConversationList } from "./ConversationList";
import { ConversationView } from "./ConversationView";
import { CustomerSidePanel } from "./CustomerSidePanel";
import { ArrowLeft } from "lucide-react";

interface ConversationListItem {
  id: string;
  channel: string;
  status: string;
  lastMessageAt: string;
  customer: { name: string };
  assignedTo?: { name: string } | null;
  messages: { content: string; sender: string; createdAt: string }[];
}

interface ConversationDetail {
  id: string;
  channel: string;
  status: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    doc: string;
    charges: {
      id: string;
      description: string;
      amountCents: number;
      dueDate: string;
      status: string;
    }[];
    collectionTasks: {
      id: string;
      title: string;
      status: string;
      priority: string;
      dueDate: string | null;
    }[];
  };
  assignedTo?: { id: string; name: string } | null;
  messages: {
    id: string;
    sender: string;
    content: string;
    createdAt: string;
    isInternal: boolean;
    senderUser?: { name: string } | null;
  }[];
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export function InboxShell() {
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [mobileView, setMobileView] = useState<"list" | "conversation">(
    "list"
  );
  const lastMessageId = useRef<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 1023px)");

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (channelFilter) params.set("channel", channelFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/inbox/conversations?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setConversations(data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingList(false);
    }
  }, [search, channelFilter, statusFilter]);

  // Fetch conversation detail
  const fetchDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/inbox/conversations/${id}`);
      const data = await res.json();
      if (data.id) {
        setDetail(data);
        const msgs = data.messages;
        if (msgs.length > 0) {
          lastMessageId.current = msgs[msgs.length - 1].id;
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Poll for new messages in active conversation
  const pollMessages = useCallback(async () => {
    if (!selectedId || !lastMessageId.current) return;
    try {
      const res = await fetch(
        `/api/inbox/conversations/${selectedId}/messages?after=${lastMessageId.current}`
      );
      const newMessages = await res.json();
      if (Array.isArray(newMessages) && newMessages.length > 0) {
        setDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: [...prev.messages, ...newMessages],
          };
        });
        lastMessageId.current = newMessages[newMessages.length - 1].id;
      }
    } catch {
      // silently fail
    }
  }, [selectedId]);

  // Fetch unread counts
  const fetchUnreadIds = useCallback(async () => {
    const unread = new Set<string>();
    conversations.forEach((c) => {
      if (c.status === "PENDENTE_IA" || c.status === "PENDENTE_HUMANO") {
        unread.add(c.id);
      }
    });
    setUnreadIds(unread);
  }, [conversations]);

  // Initial load and polling
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  useEffect(() => {
    fetchUnreadIds();
  }, [fetchUnreadIds]);

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
      fetch(`/api/inbox/conversations/${selectedId}/read`, {
        method: "POST",
      }).catch(() => {});
    }
  }, [selectedId, fetchDetail]);

  // Poll messages for active conversation
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(pollMessages, 3000);
    return () => clearInterval(interval);
  }, [selectedId, pollMessages]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileView("conversation");
    lastMessageId.current = null;
  };

  const handleSendMessage = async (content: string, isInternal: boolean) => {
    if (!selectedId) return;

    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      sender: "AGENT" as const,
      content,
      createdAt: new Date().toISOString(),
      isInternal,
      senderUser: null,
    };

    setDetail((prev) => {
      if (!prev) return prev;
      return { ...prev, messages: [...prev.messages, optimisticMsg] };
    });

    try {
      const res = await fetch(
        `/api/inbox/conversations/${selectedId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, isInternal }),
        }
      );
      const msg = await res.json();
      if (msg.id) {
        lastMessageId.current = msg.id;
        setDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === optimisticMsg.id ? msg : m
            ),
          };
        });
      }
    } catch {
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter((m) => m.id !== optimisticMsg.id),
        };
      });
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedId) return;
    try {
      await fetch(`/api/inbox/conversations/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setDetail((prev) => (prev ? { ...prev, status } : prev));
      fetchConversations();
    } catch {
      // silently fail
    }
  };

  // Mobile: show either list or conversation
  if (isMobile && mobileView === "conversation") {
    return (
      <div className="flex h-full bg-white">
        <div className="flex-1 flex flex-col min-h-0">
          <button
            onClick={() => setMobileView("list")}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border-b border-gray-200 bg-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <ConversationView
            conversation={detail}
            isLoading={isLoadingDetail}
            onSendMessage={handleSendMessage}
            onStatusChange={handleStatusChange}
            onToggleSidePanel={() => setShowSidePanel(!showSidePanel)}
            showSidePanel={showSidePanel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white">
      {/* Conversation List */}
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={handleSelect}
        search={search}
        onSearchChange={setSearch}
        channelFilter={channelFilter}
        onChannelFilterChange={setChannelFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        isLoading={isLoadingList}
        unreadIds={unreadIds}
      />

      {/* Conversation View */}
      <ConversationView
        conversation={detail}
        isLoading={isLoadingDetail}
        onSendMessage={handleSendMessage}
        onStatusChange={handleStatusChange}
        onToggleSidePanel={() => setShowSidePanel(!showSidePanel)}
        showSidePanel={showSidePanel}
      />

      {/* Side Panel */}
      {showSidePanel && detail && (
        <CustomerSidePanel customer={detail.customer} />
      )}
    </div>
  );
}
