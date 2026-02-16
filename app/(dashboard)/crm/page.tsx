"use client";

import { Suspense, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CrmClientsTab } from "@/components/crm/CrmClientsTab";
import { CrmTarefasTab } from "@/components/crm/CrmTarefasTab";
import type { CrmTarefasTabActions } from "@/components/crm/CrmTarefasTab";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";

function CrmPageContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "tarefas" ? "tarefas" : "clientes";
  const [activeTab, setActiveTab] = useState(initialTab);
  const tarefasRef = useRef<CrmTarefasTabActions | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="CRM"
        primaryAction={
          activeTab === "tarefas"
            ? { label: "Nova Tarefa", onClick: () => tarefasRef.current?.openNewTask() }
            : undefined
        }
        secondaryActions={
          activeTab === "tarefas"
            ? [{ label: "Exportar", icon: <Download className="h-4 w-4" />, onClick: () => tarefasRef.current?.exportTasks() }]
            : undefined
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes">
          <CrmClientsTab
            onSwitchToTarefas={() => setActiveTab("tarefas")}
          />
        </TabsContent>

        <TabsContent value="tarefas">
          <CrmTarefasTab actionsRef={tarefasRef} />
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
