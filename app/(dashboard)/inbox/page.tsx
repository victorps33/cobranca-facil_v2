"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { InboxShell } from "@/components/inbox/InboxShell";
import { AgentDashboardTab } from "@/components/agent/AgentDashboardTab";
import { cn } from "@/lib/cn";

function InboxPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") === "agente" ? "agente" : "conversas";
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleOpenConversation = (conversationId: string) => {
    setActiveTab("conversas");
    router.push(`/inbox?selected=${conversationId}`);
  };

  return (
    <div
      className="-m-6 lg:-m-8 flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/* Tab bar */}
      <div className="flex items-center gap-6 border-b border-gray-200 px-6 lg:px-8 shrink-0">
        <button
          onClick={() => setActiveTab("conversas")}
          className={cn(
            "pb-3 pt-4 text-sm font-medium transition-colors border-b-2",
            activeTab === "conversas"
              ? "border-primary text-primary"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Conversas
        </button>
        <button
          onClick={() => setActiveTab("agente")}
          className={cn(
            "pb-3 pt-4 text-sm font-medium transition-colors border-b-2",
            activeTab === "agente"
              ? "border-primary text-primary"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Agente AI
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "conversas" && (
        <div className="flex-1 min-h-0">
          <InboxShell />
        </div>
      )}

      {activeTab === "agente" && (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-8 py-6">
          <AgentDashboardTab onOpenConversation={handleOpenConversation} />
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div />}>
      <InboxPageContent />
    </Suspense>
  );
}
