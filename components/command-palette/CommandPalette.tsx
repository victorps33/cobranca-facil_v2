"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  Search,
  LayoutDashboard,
  Users,
  Receipt,
  Calculator,
  Bell,
  Contact,
  Inbox,
  Settings,
  Plus,
  ArrowRight,
  CornerDownLeft,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Search;
  href?: string;
  action?: () => void;
  category: "navegação" | "ação" | "cliente";
}

const staticCommands: CommandItem[] = [
  { id: "nav-dashboard", label: "Dashboard", description: "Visão geral e KPIs", icon: LayoutDashboard, href: "/", category: "navegação" },
  { id: "nav-cadastro", label: "Cadastro", description: "Gerenciar franqueados", icon: Users, href: "/clientes", category: "navegação" },
  { id: "nav-cobrancas", label: "Cobranças", description: "Listar cobranças", icon: Receipt, href: "/cobrancas", category: "navegação" },
  { id: "nav-apuracao", label: "Apuração", description: "Ciclos de apuração", icon: Calculator, href: "/apuracao", category: "navegação" },
  { id: "nav-reguas", label: "Réguas", description: "Réguas de cobrança", icon: Bell, href: "/reguas", category: "navegação" },
  { id: "nav-crm", label: "CRM", description: "Clientes e tarefas", icon: Contact, href: "/crm", category: "navegação" },
  { id: "nav-inbox", label: "Inbox", description: "Conversas e agente AI", icon: Inbox, href: "/inbox", category: "navegação" },
  { id: "nav-config", label: "Configurações", description: "Preferências do sistema", icon: Settings, href: "/configuracoes", category: "navegação" },
  { id: "act-nova-cobranca", label: "Nova Cobrança", description: "Criar uma nova cobrança", icon: Plus, href: "/cobrancas/nova", category: "ação" },
  { id: "act-novo-cliente", label: "Novo Cliente", description: "Cadastrar novo franqueado", icon: Plus, href: "/clientes/novo", category: "ação" },
  { id: "act-crm-tarefas", label: "Ver Tarefas", description: "Abrir tarefas do CRM", icon: Contact, href: "/crm?tab=tarefas", category: "ação" },
];

interface Customer {
  id: string;
  name: string;
  doc: string;
  healthStatus?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch customers once on first open
  useEffect(() => {
    if (open && customers.length === 0) {
      fetch("/api/crm/customers")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setCustomers(data.map((c: any) => ({ id: c.id, name: c.name, doc: c.doc, healthStatus: c.healthStatus })));
          }
        })
        .catch(() => {});
    }
  }, [open, customers.length]);

  // Focus and reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard shortcut to open (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
        // Opening is handled by parent
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Build results
  const results = useMemo(() => {
    const items: CommandItem[] = [];
    const q = query.toLowerCase().trim();

    if (!q) {
      // Show actions first, then navigation
      items.push(...staticCommands.filter((c) => c.category === "ação"));
      items.push(...staticCommands.filter((c) => c.category === "navegação"));
      return items;
    }

    // Filter static commands
    const matchingCommands = staticCommands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    );
    items.push(...matchingCommands);

    // Search customers
    const matchingCustomers = customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.doc.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c): CommandItem => ({
        id: `customer-${c.id}`,
        label: c.name,
        description: c.doc,
        icon: Contact,
        href: `/crm/${c.id}`,
        category: "cliente",
      }));
    items.push(...matchingCustomers);

    return items;
  }, [query, customers]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeItem = useCallback((item: CommandItem) => {
    if (item.href) router.push(item.href);
    if (item.action) item.action();
    onClose();
  }, [router, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        executeItem(results[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, executeItem, onClose]);

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  const categoryLabels: Record<string, string> = {
    "ação": "Ações rápidas",
    "navegação": "Navegação",
    "cliente": "Clientes",
  };

  // Group results by category
  const grouped: { category: string; items: CommandItem[] }[] = [];
  let currentCategory = "";
  results.forEach((item) => {
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      grouped.push({ category: item.category, items: [] });
    }
    grouped[grouped.length - 1].items.push(item);
  });

  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-gray-100">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar páginas, clientes ou ações…"
              className="flex-1 h-12 text-sm bg-transparent outline-none placeholder:text-gray-400"
            />
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-100 rounded border border-gray-200">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-400">Nenhum resultado para &ldquo;{query}&rdquo;</p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.category}>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {categoryLabels[group.category] || group.category}
                  </p>
                  {group.items.map((item) => {
                    const idx = flatIndex++;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={() => executeItem(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          idx === selectedIndex ? "bg-blue-50" : "hover:bg-gray-50"
                        )}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                          idx === selectedIndex ? "bg-blue-100" : "bg-gray-100"
                        )}>
                          <Icon className={cn("h-4 w-4", idx === selectedIndex ? "text-blue-600" : "text-gray-500")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", idx === selectedIndex ? "text-blue-700" : "text-gray-900")}>
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-[11px] text-gray-400 truncate">{item.description}</p>
                          )}
                        </div>
                        {idx === selectedIndex && (
                          <div className="flex items-center gap-1 shrink-0">
                            <ArrowRight className="h-3 w-3 text-blue-400" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex items-center px-1 py-0.5 font-mono bg-white rounded border border-gray-200 text-[9px]">↑↓</kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-2.5 w-2.5" />
                selecionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex items-center px-1 py-0.5 font-mono bg-white rounded border border-gray-200 text-[9px]">esc</kbd>
                fechar
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
