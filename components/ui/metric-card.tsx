"use client";

import { cn } from "@/lib/cn";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TooltipHint } from "@/components/ui/tooltip-hint";
import { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  tooltip?: string;
  icon?: ReactNode;
  variant?: "default" | "danger";
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  tooltip,
  icon,
  variant = "default",
  trend,
  onClick,
  className,
}: MetricCardProps) {
  const isUp = trend?.direction === "up";
  const isDown = trend?.direction === "down";

  return (
    <div
      onClick={onClick}
      className={cn(
        "w-full bg-white rounded-2xl border p-5 hover:shadow-md transition-all hover:translate-y-[-1px]",
        variant === "danger" ? "border-red-100" : "border-gray-100",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon && (
          <div
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0",
              variant === "danger"
                ? "bg-red-50 text-red-500"
                : "bg-secondary/10 text-secondary"
            )}
          >
            {icon}
          </div>
        )}
        <span className="text-xs font-medium text-gray-500 tracking-wide flex items-center gap-1.5">
          {title}
          {tooltip && <TooltipHint text={tooltip} />}
        </span>
      </div>

      <p
        className={cn(
          "text-2xl font-bold tracking-tight tabular-nums",
          variant === "danger" ? "text-red-600" : "text-gray-900"
        )}
      >
        {value}
      </p>

      {subtitle && (
        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      )}

      {trend && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-50">
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              isUp && "text-emerald-600",
              isDown && "text-red-600"
            )}
          >
            {isUp && <TrendingUp className="h-3.5 w-3.5" />}
            {isDown && <TrendingDown className="h-3.5 w-3.5" />}
            {!isUp && !isDown && <Minus className="h-3.5 w-3.5" />}
            <span>
              {isUp && "+"}
              {isDown && "-"}
              {trend.value}%
            </span>
          </div>
          <span className="text-xs text-gray-400">vs. mês anterior</span>
        </div>
      )}
    </div>
  );
}

/** @deprecated Use MetricCard instead */
export const KpiTile = MetricCard;
/** @deprecated Use MetricCard instead */
export const StatCard = MetricCard;
