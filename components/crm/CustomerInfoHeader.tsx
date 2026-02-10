"use client";

import { cn } from "@/lib/cn";
import { Mail, Phone } from "lucide-react";
import type { CrmCustomer } from "@/lib/types/crm";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  Saudável:        { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Controlado:      { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  "Exige Atenção": { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  Crítico:         { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
};

interface CustomerInfoHeaderProps {
  customer: CrmCustomer;
}

export function CustomerInfoHeader({ customer }: CustomerInfoHeaderProps) {
  const sc = statusColors[customer.healthStatus] ?? statusColors.Saudável;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {customer.name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {customer.doc}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            sc.bg,
            sc.text
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
          {customer.healthStatus}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
        <a
          href={`mailto:${customer.email}`}
          className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
        >
          <Mail className="h-3.5 w-3.5 text-gray-400" />
          {customer.email}
        </a>
        <a
          href={`tel:${customer.phone.replace(/\D/g, "")}`}
          className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
        >
          <Phone className="h-3.5 w-3.5 text-gray-400" />
          {customer.phone}
        </a>
      </div>
    </div>
  );
}
