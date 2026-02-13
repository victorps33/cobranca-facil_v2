"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CustomerInfoHeader } from "@/components/crm/CustomerInfoHeader";
import { CustomerSummaryCards } from "@/components/crm/CustomerSummaryCards";
import { ChargesTab } from "@/components/crm/ChargesTab";
import { InteractionsTab } from "@/components/crm/InteractionsTab";
import { TasksTab } from "@/components/crm/TasksTab";
import { TimelineTab } from "@/components/crm/TimelineTab";
import { AddInteractionDialog } from "@/components/crm/AddInteractionDialog";
import { CreateTaskDialog } from "@/components/crm/CreateTaskDialog";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/use-toast";
import type { CrmCustomer, CrmCharge, CrmInteraction, CrmTask } from "@/lib/types/crm";
import type { Cobranca } from "@/lib/types";
import { AlertTriangle, Loader2, Mail, Phone, MessageCircle, Plus } from "lucide-react";
import type { UserRole } from "@prisma/client";

type TabKey = "timeline" | "cobrancas" | "interacoes" | "tarefas";

const tabs: { key: TabKey; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "cobrancas", label: "Cobranças" },
  { key: "interacoes", label: "Interações" },
  { key: "tarefas", label: "Tarefas" },
];

const chargeStatusMap: Record<CrmCharge["status"], Cobranca["status"]> = {
  PENDING: "Aberta",
  PAID: "Paga",
  OVERDUE: "Vencida",
  CANCELED: "Cancelada",
};

function calcFaixaRisco(inadimplencia: number): "A" | "B" | "C" | "D" | "E" {
  if (inadimplencia <= 0.02) return "A";
  if (inadimplencia <= 0.05) return "B";
  if (inadimplencia <= 0.15) return "C";
  if (inadimplencia <= 0.25) return "D";
  return "E";
}

// Map API CrmCharge to Cobranca for sub-components
function mapChargeToCobranca(ch: CrmCharge, customerName: string): Cobranca {
  const amountReais = ch.amountCents / 100;
  const isPaid = ch.status === "PAID";
  return {
    id: ch.id,
    cliente: customerName,
    clienteId: ch.customerId,
    categoria: "Royalties",
    descricao: ch.description,
    dataEmissao: ch.createdAt,
    dataVencimento: ch.dueDate,
    dataPagamento: isPaid ? ch.dueDate : undefined,
    valorOriginal: amountReais,
    valorPago: isPaid ? amountReais : 0,
    valorAberto: isPaid || ch.status === "CANCELED" ? 0 : amountReais,
    formaPagamento: "Boleto",
    status: chargeStatusMap[ch.status],
    nfEmitida: isPaid,
    competencia: new Date(ch.dueDate).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }),
  };
}

export default function CrmClienteDetalhePage() {
  const params = useParams();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const isReadOnly = userRole === "VISUALIZADOR";

  const [activeTab, setActiveTab] = useState<TabKey>("timeline");
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  // API data
  const [customer, setCustomer] = useState<CrmCustomer | null>(null);
  const [charges, setCharges] = useState<CrmCharge[]>([]);
  const [interactions, setInteractions] = useState<CrmInteraction[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/crm/customers/${params.id}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setCustomer(data.customer);
          setCharges(data.charges);
          setInteractions(data.interactions);
          setTasks(data.tasks);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  // Mapped data for sub-components
  const cobrancas = useMemo(
    () =>
      charges.map((ch) => mapChargeToCobranca(ch, customer?.name ?? "")),
    [charges, customer?.name]
  );

  const stats = useMemo(() => {
    if (!customer) return { totalVencido: 0, valorVencido: 0, diasInadimplente: 0, faixaRisco: "A" as const };

    const vencidas = charges.filter((c) => c.status === "OVERDUE");
    const valorVencido = vencidas.reduce((s, c) => s + c.amountCents, 0);
    const hoje = new Date();

    let diasInadimplente = 0;
    if (vencidas.length > 0) {
      const oldest = vencidas.reduce((min, c) =>
        c.dueDate < min.dueDate ? c : min
      );
      const diff = hoje.getTime() - new Date(oldest.dueDate).getTime();
      diasInadimplente = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    }

    return {
      totalVencido: vencidas.length,
      valorVencido: valorVencido / 100,
      diasInadimplente,
      faixaRisco: calcFaixaRisco(customer.inadimplencia),
    };
  }, [charges, customer]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Carregando cliente...</span>
      </div>
    );
  }

  if (notFound || !customer) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "CRM", href: "/crm" },
            { label: "Não encontrado" },
          ]}
        />
        <div className="bg-white rounded-2xl border border-gray-100 px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            O cliente com este ID não foi encontrado.
          </p>
          <Link
            href="/crm"
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Voltar para CRM
          </Link>
        </div>
      </div>
    );
  }

  const handleAddInteraction = async (
    data: Omit<CrmInteraction, "id" | "customerId" | "customerName" | "createdBy" | "createdById" | "createdAt">
  ) => {
    try {
      const res = await fetch("/api/crm/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          type: data.type,
          direction: data.direction,
          content: data.content,
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      const newInteraction: CrmInteraction = {
        id: created.id,
        customerId: created.customerId,
        customerName: customer.name,
        chargeId: created.chargeId,
        type: created.type,
        direction: created.direction,
        content: created.content,
        createdBy: created.createdBy?.name ?? session?.user?.name ?? "Usuário",
        createdById: created.createdById,
        createdAt: created.createdAt,
      };
      setInteractions((prev) => [newInteraction, ...prev]);
      setActiveTab("interacoes");
      toast({ title: "Interação registrada", description: "A interação foi adicionada ao histórico." });
    } catch {
      toast({ title: "Erro", description: "Falha ao registrar interação.", variant: "destructive" });
    }
  };

  const handleAddTask = async (
    data: Pick<CrmTask, "title" | "description" | "priority" | "dueDate" | "assignedTo" | "assignedToId">
  ) => {
    try {
      const res = await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          title: data.title,
          description: data.description || null,
          priority: data.priority,
          dueDate: data.dueDate || null,
          assignedToId: data.assignedToId || null,
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      const newTask: CrmTask = {
        id: created.id,
        customerId: created.customerId,
        customerName: customer.name,
        chargeId: created.chargeId,
        title: created.title,
        description: created.description,
        status: created.status,
        priority: created.priority,
        dueDate: created.dueDate,
        assignedTo: created.assignedTo?.name ?? null,
        assignedToId: created.assignedToId,
        completedAt: created.completedAt,
        createdBy: created.createdBy?.name ?? session?.user?.name ?? "Usuário",
        createdById: created.createdById,
        createdAt: created.createdAt,
      };
      setTasks((prev) => [newTask, ...prev]);
      setActiveTab("tarefas");
      toast({ title: "Tarefa criada", description: `"${data.title}" foi adicionada.` });
    } catch {
      toast({ title: "Erro", description: "Falha ao criar tarefa.", variant: "destructive" });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/crm/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONCLUIDA" }),
      });
      if (!res.ok) throw new Error();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "CONCLUIDA" as const, completedAt: new Date().toISOString() }
            : t
        )
      );
      toast({ title: "Tarefa concluída", description: "A tarefa foi marcada como concluída." });
    } catch {
      toast({ title: "Erro", description: "Falha ao concluir tarefa.", variant: "destructive" });
    }
  };

  const handleDeleteInteraction = async (interactionId: string) => {
    try {
      const res = await fetch(`/api/crm/interactions/${interactionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setInteractions((prev) => prev.filter((i) => i.id !== interactionId));
      toast({ title: "Interação excluída", description: "A interação foi removida do histórico." });
    } catch {
      toast({ title: "Erro", description: "Falha ao excluir interação.", variant: "destructive" });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/crm/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast({ title: "Tarefa excluída", description: "A tarefa foi removida." });
    } catch {
      toast({ title: "Erro", description: "Falha ao excluir tarefa.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "CRM", href: "/crm" },
          { label: customer.name },
        ]}
      />

      <CustomerInfoHeader customer={customer} />

      {/* Action bar */}
      {!isReadOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`mailto:${customer.email}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:shadow-sm transition-all"
          >
            <Mail className="h-4 w-4" />
            Enviar E-mail
          </a>
          <a
            href={`tel:${customer.phone.replace(/\D/g, "")}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:shadow-sm transition-all"
          >
            <Phone className="h-4 w-4" />
            Ligar
          </a>
          <button
            onClick={() => setInteractionDialogOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:shadow-sm transition-all"
          >
            <MessageCircle className="h-4 w-4" />
            Registrar Interação
          </button>
          <button
            onClick={() => setTaskDialogOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </button>
        </div>
      )}

      <CustomerSummaryCards stats={stats} />

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.label}
              {tab.key === "timeline" && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({interactions.length + tasks.length + charges.length})
                </span>
              )}
              {tab.key === "cobrancas" && (
                <span className="ml-1.5 text-xs text-gray-400">({charges.length})</span>
              )}
              {tab.key === "interacoes" && (
                <span className="ml-1.5 text-xs text-gray-400">({interactions.length})</span>
              )}
              {tab.key === "tarefas" && (
                <span className="ml-1.5 text-xs text-gray-400">({tasks.length})</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "timeline" && (
        <TimelineTab
          interactions={interactions}
          tasks={tasks}
          cobrancas={cobrancas}
        />
      )}
      {activeTab === "cobrancas" && <ChargesTab cobrancas={cobrancas} />}
      {activeTab === "interacoes" && (
        <InteractionsTab
          interactions={interactions}
          onAdd={() => setInteractionDialogOpen(true)}
          onDelete={isReadOnly ? undefined : handleDeleteInteraction}
          hideAddButton={isReadOnly}
          customerName={customer.name}
        />
      )}
      {activeTab === "tarefas" && (
        <TasksTab
          tasks={tasks}
          onAdd={() => setTaskDialogOpen(true)}
          onComplete={isReadOnly ? undefined : handleCompleteTask}
          onDelete={isReadOnly ? undefined : handleDeleteTask}
          hideAddButton={isReadOnly}
        />
      )}

      {/* Dialogs — only render if not read-only */}
      {!isReadOnly && (
        <>
          <AddInteractionDialog
            open={interactionDialogOpen}
            onOpenChange={setInteractionDialogOpen}
            customerName={customer.name}
            onSave={handleAddInteraction}
          />
          <CreateTaskDialog
            open={taskDialogOpen}
            onOpenChange={setTaskDialogOpen}
            customerName={customer.name}
            onSave={handleAddTask}
          />
        </>
      )}
    </div>
  );
}
