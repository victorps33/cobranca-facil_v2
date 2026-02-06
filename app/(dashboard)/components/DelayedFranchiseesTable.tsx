"use client";

import { cn } from "@/lib/cn";
import { Eye, Mail, Plus, MoreHorizontal } from "lucide-react";
import Link from "next/link";

interface Franchisee {
  id: string;
  name: string;
  valueOverdue: number;
  daysOverdue: number;
  riskProfile: "Crítico" | "Exige Atenção" | "Controlado";
  consecutive: number;
}

interface DelayedFranchiseesTableProps {
  data?: Franchisee[];
}

const defaultData: Franchisee[] = [
  { id: "1", name: "Franquia Recife", valueOverdue: 28500, daysOverdue: 120, riskProfile: "Crítico", consecutive: 5 },
  { id: "2", name: "Franquia Fortaleza", valueOverdue: 18200, daysOverdue: 95, riskProfile: "Crítico", consecutive: 4 },
  { id: "3", name: "Franquia Salvador", valueOverdue: 12800, daysOverdue: 67, riskProfile: "Exige Atenção", consecutive: 3 },
  { id: "4", name: "Franquia Manaus", valueOverdue: 9500, daysOverdue: 45, riskProfile: "Exige Atenção", consecutive: 3 },
  { id: "5", name: "Franquia Curitiba", valueOverdue: 7200, daysOverdue: 38, riskProfile: "Controlado", consecutive: 3 },
  { id: "6", name: "Franquia Porto Alegre", valueOverdue: 5800, daysOverdue: 32, riskProfile: "Controlado", consecutive: 3 },
];

const riskStyles = {
  "Crítico": { bg: "bg-red-50", text: "text-red-700" },
  "Exige Atenção": { bg: "bg-amber-50", text: "text-amber-700" },
  "Controlado": { bg: "bg-blue-50", text: "text-blue-700" },
};

export function DelayedFranchiseesTable({ data = defaultData }: DelayedFranchiseesTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Franqueados com Atraso Recorrente</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.length} franqueados identificados pela Júlia com padrão de atraso nos últimos 3 meses
          </p>
        </div>
        <Link
          href="/dividas"
          className="text-sm font-medium text-[#F85B00] hover:underline"
        >
          Ver todos
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                Franqueado
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                Valor em Atraso
              </th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                Dias em Atraso
              </th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                Perfil de Risco
              </th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                Meses Consecutivos
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((franchisee) => {
              const styles = riskStyles[franchisee.riskProfile];
              return (
                <tr
                  key={franchisee.id}
                  className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                        {franchisee.name.split(" ")[1]?.[0] || franchisee.name[0]}
                      </div>
                      <span className="font-medium text-gray-900">{franchisee.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-gray-900">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(franchisee.valueOverdue)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "text-sm font-medium",
                      franchisee.daysOverdue > 90 ? "text-red-600" :
                      franchisee.daysOverdue > 60 ? "text-amber-600" :
                      "text-gray-600"
                    )}>
                      {franchisee.daysOverdue} dias
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        styles.bg,
                        styles.text
                      )}
                    >
                      {franchisee.riskProfile}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm text-gray-600">{franchisee.consecutive}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 hover:text-gray-600"
                        title="Abrir histórico"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 hover:text-gray-600"
                        title="Enviar mensagem"
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 hover:text-gray-600"
                        title="Criar cobrança"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
