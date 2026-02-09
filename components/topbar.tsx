"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Clock, LogOut, User } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppNowInfo {
  date: string;
  isSimulated: boolean;
}

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

export function TopBar() {
  const { data: session } = useSession();
  const [appNowInfo, setAppNowInfo] = useState<AppNowInfo | null>(null);

  const fetchAppNow = async () => {
    try {
      const res = await fetch("/api/app-state");
      const data = await res.json();
      setAppNowInfo(data);
    } catch (error) {
      // Silently fail - not critical
    }
  };

  useEffect(() => {
    fetchAppNow();
    const interval = setInterval(fetchAppNow, 30000);
    return () => clearInterval(interval);
  }, []);

  const userName = session?.user?.name || "Usuário";
  const userRole = session?.user?.role ? roleLabels[session.user.role] || session.user.role : "";
  const initials = getUserInitials(session?.user?.name);

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="flex h-16 items-center justify-end px-6">
        <div className="flex items-center gap-4">
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

          {/* Notifications */}
          <button aria-label="Notificações" className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <Bell className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full" />
          </button>

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 pl-3 border-l border-gray-100 outline-none">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                  {initials}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500">{userRole}</p>
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
