"use client";

import { cn } from "@/lib/cn";

interface RiskBarProps {
  value: number; // 0-100
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function RiskBar({ value, size = "md", showLabel = true }: RiskBarProps) {
  const getColor = (val: number) => {
    if (val >= 80) return "bg-red-500";
    if (val >= 60) return "bg-orange-500";
    if (val >= 40) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getTextColor = (val: number) => {
    if (val >= 80) return "text-red-600";
    if (val >= 60) return "text-orange-600";
    if (val >= 40) return "text-amber-600";
    return "text-emerald-600";
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex-1 bg-gray-100 rounded-full overflow-hidden",
          size === "sm" ? "h-1.5" : "h-2"
        )}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", getColor(value))}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            "font-medium tabular-nums",
            size === "sm" ? "text-xs" : "text-sm",
            getTextColor(value)
          )}
        >
          {value}%
        </span>
      )}
    </div>
  );
}
