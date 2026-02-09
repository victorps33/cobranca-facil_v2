"use client";

import { cn } from "@/lib/cn";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StripeKpiCardProps {
  title: string;
  value: string;
  change?: {
    value: string;
    trend: "up" | "down" | "neutral";
    label?: string;
  };
  icon?: LucideIcon;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export function StripeKpiCard({
  title,
  value,
  change,
  icon: Icon,
  subtitle,
  className,
  onClick,
}: StripeKpiCardProps) {
  const trendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Minus,
  };
  const trendColor = {
    up: "text-emerald-600 bg-emerald-50",
    down: "text-red-600 bg-red-50",
    neutral: "text-gray-600 bg-gray-50",
  };

  const TrendIcon = change ? trendIcon[change.trend] : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-white rounded-2xl p-5 transition-[box-shadow] duration-200",
        "border border-gray-100 hover:border-gray-200",
        "hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {Icon && (
          <div className="h-8 w-8 rounded-xl bg-gray-50 group-hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0">
            <Icon className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          </div>
        )}
        <span className="text-xs font-medium text-gray-500 tracking-wide">{title}</span>
      </div>

      {/* Value */}
      <div className="mb-1">
        <span className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums">
          {value}
        </span>
      </div>

      {/* Change indicator */}
      {change && TrendIcon && (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              trendColor[change.trend]
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {change.value}
          </span>
          {change.label && (
            <span className="text-xs text-gray-400">{change.label}</span>
          )}
        </div>
      )}

      {/* Subtitle */}
      {subtitle && !change && (
        <span className="text-xs text-gray-400">{subtitle}</span>
      )}

      {/* Hover indicator */}
      {onClick && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary to-primary rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

// Mini version for compact layouts
export function StripeKpiCardMini({
  title,
  value,
  trend,
}: {
  title: string;
  value: string;
  trend?: "up" | "down" | "neutral";
}) {
  const trendColor = {
    up: "text-emerald-600",
    down: "text-red-600",
    neutral: "text-gray-400",
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{title}</span>
      <span
        className={cn(
          "text-sm font-semibold",
          trend ? trendColor[trend] : "text-gray-900"
        )}
      >
        {value}
      </span>
    </div>
  );
}
