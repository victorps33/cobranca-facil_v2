"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const routeLabels: Record<string, string> = {
  "": "Dashboard",
  clientes: "Cadastro",
  novo: "Novo",
  cobrancas: "Cobranças",
  nova: "Nova Cobrança",
  apuracao: "Apuração",
  reguas: "Réguas",
  crm: "CRM",
  tarefas: "Tarefas",
  inbox: "Inbox",
  agent: "Agente AI",
  insights: "Insights",
  configuracoes: "Configurações",
  logs: "Logs",
};

function isUUID(segment: string): boolean {
  return /^[0-9a-f]{8,}$/i.test(segment.replace(/-/g, ""));
}

export function Breadcrumbs() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;
    const label = isUUID(segment)
      ? `#${segment.slice(0, 8)}`
      : routeLabels[segment] || segment;

    return { label, href, isLast };
  });

  return (
    <nav aria-label="Breadcrumbs" className="flex items-center gap-1 text-sm">
      <Link
        href="/"
        className="flex items-center text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Home className="h-3.5 w-3.5" strokeWidth={1.8} />
      </Link>

      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-gray-300" strokeWidth={2} />
          {crumb.isLast ? (
            <span className="text-gray-900 font-medium text-xs">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xs"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
