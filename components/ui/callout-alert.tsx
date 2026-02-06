"use client";

import { cn } from "@/lib/cn";
import { AlertTriangle, Info, CheckCircle, XCircle, ChevronRight } from "lucide-react";

interface CalloutAlertProps {
  type?: "info" | "warning" | "success" | "error";
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const typeConfig = {
  info: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    icon: Info,
    iconColor: "text-blue-500",
    titleColor: "text-blue-900",
    descColor: "text-blue-700",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-100",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    titleColor: "text-amber-900",
    descColor: "text-amber-700",
  },
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    icon: CheckCircle,
    iconColor: "text-emerald-500",
    titleColor: "text-emerald-900",
    descColor: "text-emerald-700",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-100",
    icon: XCircle,
    iconColor: "text-red-500",
    titleColor: "text-red-900",
    descColor: "text-red-700",
  },
};

export function CalloutAlert({
  type = "info",
  title,
  description,
  action,
  className,
}: CalloutAlertProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        config.bg,
        config.border,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("flex-shrink-0 mt-0.5", config.iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={cn("font-medium", config.titleColor)}>{title}</h4>
          {description && (
            <p className={cn("text-sm mt-1", config.descColor)}>{description}</p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className={cn(
                "inline-flex items-center gap-1 text-sm font-medium mt-2 hover:underline",
                config.titleColor
              )}
            >
              {action.label}
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
