import { cn } from "@/lib/cn";
import { CheckCircle, Clock, AlertTriangle, XCircle, Circle } from "lucide-react";

type StatusType = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" | "CANCELED" | string;

interface StatusBadgeProps {
  status: StatusType;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const statusConfig: Record<string, {
  label: string;
  className: string;
  icon: typeof Circle;
}> = {
  PENDING: {
    label: "Pendente",
    className: "bg-info-bg text-info-text border-info-border",
    icon: Clock,
  },
  PAID: {
    label: "Pago",
    className: "bg-success-bg text-success-text border-success-border",
    icon: CheckCircle,
  },
  OVERDUE: {
    label: "Vencido",
    className: "bg-danger-bg text-danger-text border-danger-border",
    icon: AlertTriangle,
  },
  CANCELLED: {
    label: "Cancelado",
    className: "bg-gray-100 text-gray-600 border-gray-200",
    icon: XCircle,
  },
  CANCELED: {
    label: "Cancelado",
    className: "bg-gray-100 text-gray-600 border-gray-200",
    icon: XCircle,
  },
};

const defaultConfig = {
  label: "Desconhecido",
  className: "bg-gray-100 text-gray-600 border-gray-200",
  icon: Circle,
};

export function StatusBadge({ 
  status, 
  showIcon = true, 
  size = "md",
  className 
}: StatusBadgeProps) {
  const config = statusConfig[status] || defaultConfig;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        sizeClasses[size],
        config.className,
        className
      )}
    >
      {showIcon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      {config.label}
    </span>
  );
}

// Export status labels for use elsewhere
export const STATUS_CONFIG = statusConfig;
