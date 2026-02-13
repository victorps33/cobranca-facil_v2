"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CrmClientsTab } from "@/components/crm/CrmClientsTab";
import { CrmTarefasTab } from "@/components/crm/CrmTarefasTab";
import { Skeleton } from "@/components/ui/skeleton";

function CrmPageContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "tarefas" ? "tarefas" : "clientes";
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        subtitle="Gestão de clientes e tarefas"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes">
          <CrmClientsTab
            onSwitchToTarefas={() => setActiveTab("tarefas")}
            onNavigateToTasks={() => setActiveTab("tarefas")}
          />
        </TabsContent>

        <TabsContent value="tarefas">
          <CrmTarefasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CrmPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><Skeleton className="h-8 w-24" /><Skeleton className="h-4 w-48" /></div>}>
      <CrmPageContent />
    </Suspense>
  );
}
