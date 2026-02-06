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
  iconColor = "text-[#85ace6]",
  iconBgColor = "bg-[#85ace6]/10",
}: KpiCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const isNeutral = change === 0 || change === undefined;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center",
              iconBgColor
            )}
          >
            <Icon className={cn("h-6 w-6", iconColor)} />
          </div>
        )}
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              isPositive && "text-emerald-600",
              isNegative && "text-red-600",
              isNeutral && "text-gray-500"
            )}
          >
            {isPositive && <TrendingUp className="h-4 w-4" />}
            {isNegative && <TrendingDown className="h-4 w-4" />}
            {isNeutral && <Minus className="h-4 w-4" />}
            <span>
              {isPositive && "+"}
              {change}%
            </span>
          </div>
          {changeLabel && (
            <span className="text-sm text-gray-400">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
