"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  CheckCircle2,
  Circle,
  X,
  ArrowRight,
  Users,
  FileText,
  Bell,
  Sparkles,
} from "lucide-react";

interface ChecklistData {
  hasCustomer: boolean;
  hasCharge: boolean;
  hasDunningRule: boolean;
  hasVisitedInsights: boolean;
}

interface OnboardingChecklistProps {
  checklist: ChecklistData;
  show: boolean;
  onDismiss: () => void;
}

const INSIGHTS_KEY = "menlo_visited_insights";

const CHECKLIST_ITEMS = [
  {
    key: "hasCustomer" as const,
    label: "Cadastrar um cliente",
    href: "/clientes/novo",
    icon: Users,
  },
  {
    key: "hasCharge" as const,
    label: "Criar uma cobrança",
    href: "/cobrancas/nova",
    icon: FileText,
  },
  {
    key: "hasDunningRule" as const,
    label: "Configurar régua",
    href: "/reguas",
    icon: Bell,
  },
  {
    key: "hasVisitedInsights" as const,
    label: "Ver insights da Júlia",
    href: "/insights",
    icon: Sparkles,
  },
];

export function OnboardingChecklist({ checklist, show, onDismiss }: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [visitedInsights, setVisitedInsights] = useState(false);

  useEffect(() => {
    setVisitedInsights(localStorage.getItem(INSIGHTS_KEY) === "true");
  }, []);

  if (dismissed || !show) return null;

  const mergedChecklist = {
    ...checklist,
    hasVisitedInsights: checklist.hasVisitedInsights || visitedInsights,
  };

  const completed = CHECKLIST_ITEMS.filter((item) => mergedChecklist[item.key]).length;
  const total = CHECKLIST_ITEMS.length;
  const allDone = completed === total;

  if (allDone) return null;

  const progress = (completed / total) * 100;

  async function handleDismiss() {
    setDismissed(true);
    await fetch("/api/onboarding/dismiss-checklist", { method: "POST" });
    onDismiss();
  }

  function handleInsightsClick() {
    localStorage.setItem(INSIGHTS_KEY, "true");
    setVisitedInsights(true);
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Primeiros Passos</h3>
            <p className="text-xs text-gray-500">
              {completed}/{total} concluído
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Dispensar checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3">
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="px-5 py-3 space-y-1">
        {CHECKLIST_ITEMS.map((item, i) => {
          const done = mergedChecklist[item.key];
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={item.key === "hasVisitedInsights" ? handleInsightsClick : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group",
                done
                  ? "opacity-60"
                  : "hover:bg-gray-50"
              )}
            >
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 text-[10px] font-bold text-gray-400">
                  {i + 1}
                </div>
              )}

              <Icon className={cn(
                "h-4 w-4 shrink-0",
                done ? "text-gray-400" : "text-gray-500"
              )} />

              <span className={cn(
                "flex-1 text-sm",
                done ? "text-gray-400 line-through" : "text-gray-700 font-medium"
              )}>
                {item.label}
              </span>

              {!done && (
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
