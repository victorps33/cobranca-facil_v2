"use client";

import {
  Sparkles,
  ExternalLink,
  Download,
  Bell,
  CheckCircle2,
} from "lucide-react";

// ── Types ──

export interface Action {
  id: string;
  type: "navigate" | "export" | "notify";
  param: string;
  label: string;
  description: string;
  status: "pending" | "completed";
}

interface ActionPlanProps {
  actions: Action[];
  onExecute: (action: Action) => void;
}

// ── Icon per type ──

const typeIcons: Record<Action["type"], typeof ExternalLink> = {
  navigate: ExternalLink,
  export: Download,
  notify: Bell,
};

// ── Component ──

export function ActionPlan({ actions, onExecute }: ActionPlanProps) {
  const completed = actions.filter((a) => a.status === "completed").length;
  const total = actions.length;
  const allDone = completed === total;
  const pendingActions = actions.filter((a) => a.status === "pending");

  function executeAll() {
    pendingActions.forEach((action) => onExecute(action));
  }

  return (
    <div className="rounded-2xl border-2 border-blue-100 bg-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">
            Plano de Ação
          </span>
        </div>
        <span className="text-xs font-medium text-gray-500">
          {completed}/{total} feitas
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
        />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {actions.map((action) => {
          const Icon = typeIcons[action.type];
          const isDone = action.status === "completed";

          return (
            <div
              key={action.id}
              className={
                isDone
                  ? "flex items-center gap-3 p-3 bg-emerald-50 rounded-xl"
                  : "flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors"
              }
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Icon className="h-5 w-5 text-gray-400" />
                )}
              </div>

              {/* Label + description */}
              <div className="flex-1 min-w-0">
                <p
                  className={
                    isDone
                      ? "text-sm font-medium text-emerald-700"
                      : "text-sm font-medium text-gray-900"
                  }
                >
                  {action.label}
                </p>
                <p
                  className={
                    isDone
                      ? "text-xs text-emerald-500 mt-0.5"
                      : "text-xs text-gray-500 mt-0.5"
                  }
                >
                  {action.description}
                </p>
              </div>

              {/* Button / status */}
              <div className="flex-shrink-0">
                {isDone ? (
                  <span className="text-xs font-medium text-emerald-600">
                    Feito
                  </span>
                ) : (
                  <button
                    onClick={() => onExecute(action)}
                    className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                  >
                    Executar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Execute all */}
      {!allDone && pendingActions.length > 1 && (
        <button
          onClick={executeAll}
          className="w-full mt-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all"
        >
          Executar todas pendentes
        </button>
      )}
    </div>
  );
}
