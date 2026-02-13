"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  Mail,
  MessageSquare,
  Phone,
  Bell,
  FileText,
  AlertTriangle,
  Plus,
  GripVertical,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react";

interface DunningStep {
  id: string;
  day: number;
  channel: "email" | "whatsapp" | "sms" | "phone" | "letter";
  title: string;
  description: string;
  enabled: boolean;
}

const channelConfig = {
  email: { icon: Mail, label: "E-mail", color: "bg-blue-500" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "bg-green-500" },
  sms: { icon: MessageSquare, label: "SMS", color: "bg-blue-500" },
  phone: { icon: Phone, label: "Ligação", color: "bg-orange-500" },
  letter: { icon: FileText, label: "Carta", color: "bg-gray-500" },
};

interface DunningTimelineProps {
  steps: DunningStep[];
  onStepsChange?: (steps: DunningStep[]) => void;
  editable?: boolean;
}

export function DunningTimeline({ steps, onStepsChange, editable = false }: DunningTimelineProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleStep = (id: string) => {
    if (onStepsChange) {
      const updated = steps.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      );
      onStepsChange(updated);
    }
  };

  const deleteStep = (id: string) => {
    if (onStepsChange) {
      onStepsChange(steps.filter((s) => s.id !== id));
    }
  };

  const sortedSteps = [...steps].sort((a, b) => a.day - b.day);

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-gray-200 via-gray-200 to-transparent" />

      {/* Steps */}
      <div className="space-y-1">
        {sortedSteps.map((step, index) => {
          const channel = channelConfig[step.channel];
          const Icon = channel.icon;
          const isEditing = editingId === step.id;

          return (
            <div
              key={step.id}
              className={cn(
                "relative pl-14 pr-4 py-4 rounded-xl transition-colors group",
                step.enabled
                  ? "bg-white hover:bg-gray-50"
                  : "bg-gray-50/50 opacity-60"
              )}
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center transition-colors",
                  step.enabled ? channel.color : "bg-gray-300"
                )}
              >
                <Icon className="h-2.5 w-2.5 text-white" />
              </div>

              {/* Day badge */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-4 hidden lg:block">
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-1 rounded-full",
                    step.day < 0
                      ? "bg-blue-50 text-blue-600"
                      : step.day === 0
                      ? "bg-amber-50 text-amber-600"
                      : "bg-red-50 text-red-600"
                  )}
                >
                  {step.day < 0 ? `${step.day}d` : step.day === 0 ? "Venc." : `+${step.day}d`}
                </span>
              </div>

              {/* Content */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "lg:hidden text-xs font-medium px-2 py-0.5 rounded-full",
                        step.day < 0
                          ? "bg-blue-50 text-blue-600"
                          : step.day === 0
                          ? "bg-amber-50 text-amber-600"
                          : "bg-red-50 text-red-600"
                      )}
                    >
                      {step.day < 0 ? `${step.day}d` : step.day === 0 ? "Venc." : `+${step.day}d`}
                    </span>
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {step.title}
                    </h4>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        step.enabled ? "bg-gray-100 text-gray-600" : "bg-gray-100 text-gray-400"
                      )}
                    >
                      {channel.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {step.description}
                  </p>
                </div>

                {/* Actions */}
                {editable && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleStep(step.id)}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        step.enabled
                          ? "hover:bg-gray-100 text-gray-400"
                          : "hover:bg-green-50 text-green-600"
                      )}
                    >
                      {step.enabled ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingId(step.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteStep(step.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add step button */}
      {editable && (
        <button className="relative pl-14 pr-4 py-3 w-full text-left rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 transition-colors mt-2 group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
            <Plus className="h-3 w-3 text-gray-400 group-hover:text-gray-600" />
          </div>
          <span className="text-sm text-gray-500 group-hover:text-gray-700">
            Adicionar etapa
          </span>
        </button>
      )}
    </div>
  );
}

// Compact version for dashboard
export function DunningTimelineCompact({ steps }: { steps: DunningStep[] }) {
  const enabledSteps = steps.filter((s) => s.enabled).sort((a, b) => a.day - b.day);

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {enabledSteps.map((step, index) => {
        const channel = channelConfig[step.channel];
        const Icon = channel.icon;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center",
                  channel.color
                )}
              >
                <Icon className="h-4 w-4 text-white" />
              </div>
              <span className="text-[10px] text-gray-500 mt-1 whitespace-nowrap">
                {step.day < 0 ? `${step.day}d` : step.day === 0 ? "Venc" : `+${step.day}d`}
              </span>
            </div>
            {index < enabledSteps.length - 1 && (
              <div className="w-6 h-px bg-gray-200 mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}
