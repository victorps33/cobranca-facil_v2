"use client";

import { cn } from "@/lib/cn";
import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  caption?: string;
  icon?: ReactNode;
  danger?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  caption,
  icon,
  danger,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow",
        danger ? "border-red-100" : "border-gray-100",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon && (
          <div
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0",
              danger ? "bg-red-50 text-red-400" : "bg-gray-50 text-gray-400"
            )}
          >
            {icon}
          </div>
        )}
        <span className="text-xs font-medium text-gray-500 tracking-wide">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-2xl font-bold tracking-tight tabular-nums",
          danger ? "text-red-600" : "text-gray-900"
        )}
      >
        {value}
      </p>
      {caption && (
        <p className="text-xs text-gray-400 mt-1">{caption}</p>
      )}
    </div>
  );
}
