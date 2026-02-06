"use client";

import { cn } from "@/lib/cn";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ReactNode } from "react";

interface KpiTileProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  icon?: ReactNode;
  variant?: "default" | "danger";
}

export function KpiTile({
  title,
  value,
  subtitle,
  trend,
  icon,
  variant = "default",
}: KpiTileProps) {
  const isUp = trend?.direction === "up";
  const isDown = trend?.direction === "down";

  return (
    <div
      className={cn(
        "w-full bg-white rounded-2xl border p-6 hover:shadow-md transition-shadow",
        variant === "danger" ? "border-red-100" : "border-gray-100"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            {icon && (
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  variant === "danger"
                    ? "bg-red-50 text-red-500"
                    : "bg-[#85ace6]/10 text-[#85ace6]"
                )}
              >
                {icon}
              </div>
            )}
            <p className="text-sm font-medium text-gray-500">{title}</p>
          </div>

          <div className="flex items-baseline gap-4">
            <p
              className={cn(
                "text-4xl font-bold tracking-tight tabular-nums",
                variant === "danger" ? "text-red-600" : "text-gray-900"
              )}
            >
              {value}
            </p>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>

          {trend && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
              <div
                className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  isUp && "text-emerald-600",
                  isDown && "text-red-600"
                )}
              >
                {isUp && <TrendingUp className="h-4 w-4" />}
                {isDown && <TrendingDown className="h-4 w-4" />}
                {!isUp && !isDown && <Minus className="h-4 w-4" />}
                <span>
                  {isUp && "+"}
                  {isDown && "-"}
                  {trend.value}%
                </span>
              </div>
              <span className="text-sm text-gray-400">vs. mês anterior</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
