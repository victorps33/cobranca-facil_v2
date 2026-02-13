"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { InboxShell } from "@/components/inbox/InboxShell";
import { AgentDashboardTab } from "@/components/agent/AgentDashboardTab";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <div className="flex flex-col" style={{ height: "calc(100vh - 5rem)" }}>
      <div className="shrink-0">
        <PageHeader title="Inbox" subtitle="Conversas e agente AI" />
      </div>

      <div className="shrink-0 mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="conversas">Conversas</TabsTrigger>
            <TabsTrigger value="agente">Agente AI</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "conversas" && (
        <div className="flex-1 min-h-0 -mx-6 lg:-mx-8 -mb-6 lg:-mb-8 mt-4">
          <InboxShell />
        </div>
      )}

      {activeTab === "agente" && (
        <div className="flex-1 min-h-0 overflow-y-auto mt-6">
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
