import { cn } from "@/lib/cn";
import { LucideIcon } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const variantStyles = {
  default: {
    border: "border-l-menlo-blue",
    iconBg: "bg-blue-50",
    iconColor: "text-menlo-blue",
    valueColor: "text-gray-900",
  },
  success: {
    border: "border-l-success",
    iconBg: "bg-success-bg",
    iconColor: "text-success",
    valueColor: "text-success",
  },
  warning: {
    border: "border-l-warning",
    iconBg: "bg-warning-bg",
    iconColor: "text-warning",
    valueColor: "text-warning",
  },
  danger: {
    border: "border-l-danger",
    iconBg: "bg-danger-bg",
    iconColor: "text-danger",
    valueColor: "text-danger",
  },
  info: {
    border: "border-l-info",
    iconBg: "bg-info-bg",
    iconColor: "text-info",
    valueColor: "text-info-text",
  },
};

const trendStyles = {
  up: "text-success",
  down: "text-danger",
  neutral: "text-gray-500",
};

export function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: SummaryCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-gray-100 p-6 transition-[border-color,box-shadow] hover:shadow-medium border-l-4",
        styles.border,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className={cn("text-2xl font-bold", styles.valueColor)}>
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            styles.iconBg
          )}
        >
          <Icon className={cn("h-5 w-5", styles.iconColor)} strokeWidth={1.5} />
        </div>
      </div>

      {trend && (
        <div className={cn("flex items-center gap-1 mt-3 text-sm", trendStyles[trend.direction])}>
          {trend.direction === "up" && (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17l5-5 5 5M7 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {trend.direction === "down" && (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 7l5 5 5-5M7 17l5-5 5 5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          <span className="font-medium">{trend.value}</span>
          <span className="text-gray-400 ml-1">vs. mês anterior</span>
        </div>
      )}
    </div>
  );
}
