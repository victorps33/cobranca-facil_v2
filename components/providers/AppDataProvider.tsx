"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

interface NotificationItem {
  id: string;
  type: "overdue_task" | "overdue_charge" | "escalation";
  title: string;
  description: string;
  href: string;
}

interface AppNowInfo {
  date: string;
  isSimulated: boolean;
}

interface AppData {
  overdueTasks: number;
  notifications: NotificationItem[];
  inboxUnread: number;
  appNow: AppNowInfo | null;
}

const AppDataContext = createContext<AppData>({
  overdueTasks: 0,
  notifications: [],
  inboxUnread: 0,
  appNow: null,
});

export function useAppData() {
  return useContext(AppDataContext);
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [appNow, setAppNow] = useState<AppNowInfo | null>(null);

  // Fetch tasks + charges (notifications) — every 60s
  const fetchNotifications = useCallback(async () => {
    const items: NotificationItem[] = [];
    let taskCount = 0;
    try {
      const [tasksRes, chargesRes] = await Promise.all([
        fetch("/api/crm/tasks").then((r) => r.json()).catch(() => []),
        fetch("/api/charges").then((r) => r.json()).catch(() => []),
      ]);

      if (Array.isArray(tasksRes)) {
        const hoje = new Date();
        const overdue = tasksRes.filter(
          (t: { dueDate?: string | null; status: string }) =>
            t.dueDate &&
            new Date(t.dueDate) < hoje &&
            (t.status === "PENDENTE" || t.status === "EM_ANDAMENTO")
        );
        taskCount = overdue.length;
        if (overdue.length > 0) {
          items.push({
            id: "overdue-tasks",
            type: "overdue_task",
            title: `${overdue.length} tarefa${overdue.length > 1 ? "s" : ""} atrasada${overdue.length > 1 ? "s" : ""}`,
            description: "Verifique as tarefas pendentes no CRM",
            href: "/crm?tab=tarefas",
          });
        }
      }

      if (Array.isArray(chargesRes)) {
        const overdueCharges = chargesRes.filter((c: any) => c.status === "VENCIDA");
        if (overdueCharges.length > 0) {
          const totalCents = overdueCharges.reduce((s: number, c: any) => s + (c.amountCents || 0), 0);
          const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalCents / 100);
          items.push({
            id: "overdue-charges",
            type: "overdue_charge",
            title: `${overdueCharges.length} cobrança${overdueCharges.length > 1 ? "s" : ""} vencida${overdueCharges.length > 1 ? "s" : ""}`,
            description: `Total: ${fmtBRL}`,
            href: "/cobrancas",
          });
        }
      }
    } catch {}
    setOverdueTasks(taskCount);
    setNotifications(items);
  }, []);

  // Fetch inbox unread — every 10s
  const fetchInboxUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/unread-count");
      const data = await res.json();
      setInboxUnread(data.unreadCount || 0);
    } catch {}
  }, []);

  // Fetch app state — every 30s
  const fetchAppNow = useCallback(async () => {
    try {
      const res = await fetch("/api/app-state");
      const data = await res.json();
      setAppNow(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    fetchInboxUnread();
    const interval = setInterval(fetchInboxUnread, 10000);
    return () => clearInterval(interval);
  }, [fetchInboxUnread]);

  useEffect(() => {
    fetchAppNow();
    const interval = setInterval(fetchAppNow, 30000);
    return () => clearInterval(interval);
  }, [fetchAppNow]);

  return (
    <AppDataContext.Provider value={{ overdueTasks, notifications, inboxUnread, appNow }}>
      {children}
    </AppDataContext.Provider>
  );
}
