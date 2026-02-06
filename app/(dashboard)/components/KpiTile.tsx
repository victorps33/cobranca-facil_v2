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
  iconColor = "text-[#85ace6]",
  iconBgColor = "bg-[#85ace6]/10",
}: KpiTileProps) {
  const isPositive = trend && trend.value > 0;
  const isNegative = trend && trend.value < 0;

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  iconBgColor
                )}
              >
                <Icon className={cn("h-5 w-5", iconColor)} />
              </div>
            )}
            <p className="text-sm font-medium text-gray-500">{title}</p>
          </div>
          
          <div className="flex items-baseline gap-4">
            <p className="text-4xl font-bold text-gray-900 tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>

          {trend && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
              <div
                className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  isPositive && "text-emerald-600",
                  isNegative && "text-red-600",
                  !isPositive && !isNegative && "text-gray-500"
                )}
              >
                {isPositive && <TrendingUp className="h-4 w-4" />}
                {isNegative && <TrendingDown className="h-4 w-4" />}
                {!isPositive && !isNegative && <Minus className="h-4 w-4" />}
                <span>
                  {isPositive && "+"}
                  {trend.value}%
                </span>
              </div>
              <span className="text-sm text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
