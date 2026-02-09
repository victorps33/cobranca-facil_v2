"use client";

import { cn } from "@/lib/cn";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
}

const variantStyles = {
  default: {
    border: "border-l-secondary",
    iconBg: "bg-secondary/10",
    iconColor: "text-secondary",
  },
  primary: {
    border: "border-l-primary",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  success: {
    border: "border-l-green-500",
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
  },
  warning: {
    border: "border-l-amber-500",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  danger: {
    border: "border-l-red-500",
    iconBg: "bg-red-50",
    iconColor: "text-red-600",
  },
};

const trendStyles = {
  up: "text-green-600",
  down: "text-red-600",
  neutral: "text-gray-500",
};

export function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: KpiCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-gray-100 p-5 transition-[border-color,box-shadow] hover:shadow-md border-l-4",
        styles.border,
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0",
            styles.iconBg
          )}
        >
          <Icon className={cn("h-4 w-4", styles.iconColor)} strokeWidth={1.5} />
        </div>
        <span className="text-xs font-medium text-gray-500 tracking-wide">{title}</span>
      </div>

      <p className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums">{value}</p>
      {description && (
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      )}
      {trend && (
        <div className={cn("flex items-center gap-1 mt-3 pt-2 border-t border-gray-50 text-xs", trendStyles[trend.direction])}>
          {trend.direction === "up" && (
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          )}
          {trend.direction === "down" && (
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          <span className="font-medium">{trend.value}</span>
          <span className="text-gray-400 ml-1">vs. período anterior</span>
        </div>
      )}
    </div>
  );
}
