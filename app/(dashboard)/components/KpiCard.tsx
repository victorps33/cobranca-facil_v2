"use client";

import { cn } from "@/lib/cn";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "text-secondary",
  iconBgColor = "bg-secondary/10",
}: KpiCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const isNeutral = change === 0 || change === undefined;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        {Icon && (
          <div
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0",
              iconBgColor
            )}
          >
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
        )}
        <span className="text-xs font-medium text-gray-500 tracking-wide">{title}</span>
      </div>

      <p className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums">{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      )}

      {change !== undefined && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-50">
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              isPositive && "text-emerald-600",
              isNegative && "text-red-600",
              isNeutral && "text-gray-500"
            )}
          >
            {isPositive && <TrendingUp className="h-3.5 w-3.5" />}
            {isNegative && <TrendingDown className="h-3.5 w-3.5" />}
            {isNeutral && <Minus className="h-3.5 w-3.5" />}
            <span>
              {isPositive && "+"}
              {change}%
            </span>
          </div>
          {changeLabel && (
            <span className="text-xs text-gray-400">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
