"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/cn";
import { MenloLogo } from "@/components/brand/MenloLogo";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Bell,
  Settings,
  ChevronLeft,
  ChevronDown,
  Plus,
  Calculator,
  Contact,
  Inbox,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import type { UserRole } from "@prisma/client";
import { useAppData } from "@/components/providers/AppDataProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useFranqueadora } from "@/components/providers/FranqueadoraProvider";

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
  badge?: number;
};

const allRoles: UserRole[] = ["ADMINISTRADOR", "FINANCEIRO", "OPERACIONAL", "VISUALIZADOR"];

const baseNavigation: Omit<NavItem, "badge">[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: allRoles },
  { name: "Cadastro", href: "/clientes", icon: Users, roles: allRoles },
  { name: "Apuração", href: "/apuracao", icon: Calculator, roles: allRoles },
  { name: "Cobranças", href: "/cobrancas", icon: Receipt, roles: allRoles },
  { name: "Escalonamento", href: "/cobrancas/escalonamento", icon: AlertTriangle, roles: ["ADMINISTRADOR", "OPERACIONAL"] },
  { name: "Réguas", href: "/reguas", icon: Bell, roles: allRoles },
  { name: "CRM", href: "/crm", icon: Contact, roles: allRoles },
  { name: "Inbox", href: "/inbox", icon: Inbox, roles: allRoles },
];

const secondaryNav: NavItem[] = [
  { name: "Configurações", href: "/configuracoes", icon: Settings, roles: allRoles },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const preferences = usePreferences();
  const [collapsed, setCollapsed] = useState(preferences.sidebarCollapsed);

  useEffect(() => {
    setCollapsed(preferences.sidebarCollapsed);
  }, [preferences.sidebarCollapsed]);

  const userRole = session?.user?.role as UserRole | undefined;

  const { overdueTasks: atrasadas, inboxUnread } = useAppData();

  const { isGroupUser, franqueadoras, activeFranqueadoraId, setActiveFranqueadoraId } = useFranqueadora();

  const navigation: NavItem[] = useMemo(
    () =>
      baseNavigation.map((item) => ({
        ...item,
        badge:
          item.name === "CRM" && atrasadas > 0
            ? atrasadas
            : item.name === "Inbox" && inboxUnread > 0
              ? inboxUnread
              : undefined,
      })),
    [atrasadas, inboxUnread]
  );

  const visibleNav = navigation.filter(
    (item) => !userRole || item.roles.includes(userRole)
  );

  const visibleSecondaryNav = secondaryNav.filter(
    (item) => !userRole || item.roles.includes(userRole)
  );

  const showQuickAction = true;

  return (
    <aside
      aria-label="Menu principal"
      className={cn(
        "flex h-full flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex h-16 items-center border-b border-gray-100 dark:border-gray-800 overflow-hidden",
        collapsed ? "justify-center px-2" : "px-5"
      )}>
        <Link href="/" className="shrink-0">
          <MenloLogo size={collapsed ? "sm" : "md"} />
        </Link>
      </div>

      {/* Franqueadora Selector — only for group users */}
      {isGroupUser && !collapsed && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
            Subsidiária
          </label>
          <div className="relative">
            <select
              value={activeFranqueadoraId}
              onChange={(e) => setActiveFranqueadoraId(e.target.value)}
              className="w-full appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            >
              <option value="all">Todas</option>
              {franqueadoras.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}
      {isGroupUser && collapsed && (
        <div className="px-2 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-center">
          <button
            title={activeFranqueadoraId === "all" ? "Todas" : franqueadoras.find(f => f.id === activeFranqueadoraId)?.nome ?? ""}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500"
          >
            <Building2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Quick Action */}
      {!collapsed && showQuickAction && (
        <div className="px-4 py-4">
          <Link
            href="/cobrancas/nova"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova Cobrança
          </Link>
        </div>
      )}

      {/* Main Navigation */}
      <nav aria-label="Navegação principal" className="flex-1 px-3 py-2 space-y-1">
        {visibleNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary/20 text-gray-900 dark:text-gray-100"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100",
                collapsed && "justify-center px-2 relative"
              )}
              title={collapsed ? item.name : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isActive ? "text-primary" : "text-gray-500 dark:text-gray-500"
                )}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              {!collapsed && (
                <span className="flex-1 flex items-center justify-between">
                  {item.name}
                  {item.badge != null && item.badge > 0 && (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
                      {item.badge}
                    </span>
                  )}
                </span>
              )}
              {collapsed && item.badge != null && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Secondary Navigation */}
      {visibleSecondaryNav.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
          {visibleSecondaryNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  isActive
                    ? "bg-secondary/20 text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.name : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isActive ? "text-primary" : "text-gray-500 dark:text-gray-500"
                  )}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-3 flex justify-end">
        <button
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            preferences.setPreferences({ sidebarCollapsed: next });
          }}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180"
            )}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
      </div>
    </aside>
  );
}
