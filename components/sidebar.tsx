"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { MenloLogo } from "@/components/brand/MenloLogo";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Bell,
  Settings,
  ChevronLeft,
  Plus,
  Calculator,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Insights", href: "/insights", icon: Sparkles },
  { name: "Franqueados", href: "/clientes", icon: Users },
  { name: "Apuração", href: "/apuracao", icon: Calculator },
  { name: "Cobranças", href: "/cobrancas", icon: Receipt },
  { name: "Réguas", href: "/reguas", icon: Bell },
];

const secondaryNav = [
  { name: "Configurações", href: "/configuracoes", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      aria-label="Menu principal"
      className={cn(
        "flex h-full flex-col bg-white border-r border-gray-100 transition-[width] duration-300",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center px-5 border-b border-gray-100">
        <Link href="/">
          <MenloLogo size={collapsed ? "sm" : "md"} />
        </Link>
      </div>

      {/* Quick Action */}
      {!collapsed && (
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
        {navigation.map((item) => {
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
                  ? "bg-secondary/20 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.name : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isActive ? "text-primary" : "text-gray-500"
                )}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Secondary Navigation */}
      <div className="px-3 py-2 border-t border-gray-100">
        {secondaryNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary/20 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.name : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isActive ? "text-primary" : "text-gray-500"
                )}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </div>

      {/* Collapse Toggle */}
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 w-full transition-colors",
            collapsed && "justify-center px-2"
          )}
        >
          <ChevronLeft
            className={cn(
              "h-5 w-5 transition-transform",
              collapsed && "rotate-180"
            )}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          {!collapsed && <span>Recolher menu</span>}
        </button>
      </div>
    </aside>
  );
}
