"use client";

import Link from "next/link";
import { User, Mail, Phone, FileText, ExternalLink, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/utils";

interface CustomerSidePanelProps {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    doc: string;
    charges: {
      id: string;
      description: string;
      amountCents: number;
      dueDate: string;
      status: string;
    }[];
    collectionTasks: {
      id: string;
      title: string;
      status: string;
      priority: string;
      dueDate: string | null;
    }[];
  };
}

const chargeStatusColors: Record<string, string> = {
  PENDING: "text-yellow-600",
  OVERDUE: "text-red-600",
  PAID: "text-green-600",
};

export function CustomerSidePanel({ customer }: CustomerSidePanelProps) {
  const totalDebt = customer.charges.reduce(
    (sum, c) => sum + c.amountCents,
    0
  );
  const hasOverdue = customer.charges.some((c) => c.status === "OVERDUE");

  return (
    <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="h-5 w-5 text-gray-500" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {customer.name}
            </h4>
            <p className="text-xs text-gray-500">{customer.doc}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            <span className="truncate">{customer.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            {customer.phone}
          </div>
        </div>

        <Link
          href={`/crm/${customer.id}`}
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
        >
          Ver no CRM <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Financial summary */}
      <div className="p-4 border-b border-gray-100">
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Financeiro
        </h5>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(totalDebt)}
          </span>
          {hasOverdue && (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
        </div>
        <p className="text-xs text-gray-500">
          {customer.charges.length} cobrança(s) em aberto
        </p>
      </div>

      {/* Charges */}
      <div className="p-4 border-b border-gray-100">
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Cobranças
        </h5>
        {customer.charges.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma cobrança em aberto</p>
        ) : (
          <div className="space-y-2">
            {customer.charges.map((charge) => (
              <div
                key={charge.id}
                className="flex items-start justify-between text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-700 truncate">
                    {charge.description}
                  </p>
                  <p className="text-gray-400">
                    Venc. {formatDate(new Date(charge.dueDate))}
                  </p>
                </div>
                <span
                  className={cn(
                    "font-semibold flex-shrink-0 ml-2",
                    chargeStatusColors[charge.status] || "text-gray-600"
                  )}
                >
                  {formatCurrency(charge.amountCents)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="p-4">
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Tarefas
        </h5>
        {customer.collectionTasks.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma tarefa aberta</p>
        ) : (
          <div className="space-y-2">
            {customer.collectionTasks.map((task) => (
              <div
                key={task.id}
                className="text-xs p-2 bg-gray-50 rounded-lg"
              >
                <p className="font-medium text-gray-700">{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-gray-400">{task.status}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-400">{task.priority}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
