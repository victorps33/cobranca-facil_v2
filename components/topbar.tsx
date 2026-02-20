"use client";

import { useSession, signOut } from "next-auth/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Clock, LogOut, User, Sparkles, Search, AlertTriangle, Receipt, ListTodo } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppData } from "@/components/providers/AppDataProvider";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getUserInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const roleLabels: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  FINANCEIRO: "Financeiro",
  OPERACIONAL: "Operacional",
  VISUALIZADOR: "Visualizador",
};

interface TopBarProps {
  onOpenJulia?: () => void;
  onOpenCommandPalette?: () => void;
  juliaDisabled?: boolean;
}

export function TopBar({ onOpenJulia, onOpenCommandPalette, juliaDisabled }: TopBarProps) {
  const { data: session } = useSession();
  const { notifications, appNow: appNowInfo } = useAppData();

  const userName = session?.user?.name || "Usuário";
  const userRole = session?.user?.role ? roleLabels[session.user.role] || session.user.role : "";
  const initials = getUserInitials(session?.user?.name);

  const notifIcons: Record<string, typeof AlertTriangle> = {
    overdue_task: ListTodo,
    overdue_charge: Receipt,
    escalation: AlertTriangle,
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left: Search trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden lg:flex items-center gap-2 px-3 py-2 text-sm text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-500 transition-colors w-64"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-white rounded border border-gray-200">
            ⌘K
          </kbd>
        </button>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Date Badge */}
          {appNowInfo && (
            <div
              className={cn(
                "hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
                appNowInfo.isSimulated
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="font-medium">
                {format(new Date(appNowInfo.date), "dd MMM yyyy", { locale: ptBR })}
              </span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                  appNowInfo.isSimulated
                    ? "bg-amber-200/60"
                    : "bg-emerald-200/60"
                )}
              >
                {appNowInfo.isSimulated ? "Demo" : "Real"}
              </span>
            </div>
          )}

          {/* Julia AI Button */}
          {!juliaDisabled && (
            <button
              onClick={onOpenJulia}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
              title="Abrir Júlia AI"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden lg:inline">Júlia</span>
            </button>
          )}

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Notificações" className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <Bell className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-xl">
              <DropdownMenuLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Notificações
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Bell className="h-6 w-6 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Tudo em dia!</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const Icon = notifIcons[notif.type] || AlertTriangle;
                  return (
                    <DropdownMenuItem key={notif.id} className="flex items-start gap-3 p-3 cursor-pointer rounded-lg" asChild>
                      <a href={notif.href}>
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                          notif.type === "overdue_task" ? "bg-amber-50" : notif.type === "overdue_charge" ? "bg-red-50" : "bg-blue-50"
                        )}>
                          <Icon className={cn(
                            "h-4 w-4",
                            notif.type === "overdue_task" ? "text-amber-500" : notif.type === "overdue_charge" ? "text-red-500" : "text-blue-500"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{notif.description}</p>
                        </div>
                      </a>
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 pl-3 border-l border-gray-100 dark:border-gray-800 outline-none">
                <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-white text-sm font-semibold">
                  {initials}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{userName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{userRole}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 cursor-pointer"
                onClick={() => signOut({ callbackUrl: "/auth/login" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
