"use client";

import { cn } from "@/lib/cn";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface KpiTileProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
}

export function KpiTile({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  iconColor = "text-secondary",
  iconBgColor = "bg-secondary/10",
}: KpiTileProps) {
  const isPositive = trend && trend.value > 0;
  const isNegative = trend && trend.value < 0;

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
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

      {trend && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-50">
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              isPositive && "text-emerald-600",
              isNegative && "text-red-600",
              !isPositive && !isNegative && "text-gray-500"
            )}
          >
            {isPositive && <TrendingUp className="h-3.5 w-3.5" />}
            {isNegative && <TrendingDown className="h-3.5 w-3.5" />}
            {!isPositive && !isNegative && <Minus className="h-3.5 w-3.5" />}
            <span>
              {isPositive && "+"}
              {trend.value}%
            </span>
          </div>
          <span className="text-xs text-gray-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
