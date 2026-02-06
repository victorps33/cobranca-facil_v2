"use client";

import { cn } from "@/lib/cn";

interface RiskCategory {
  name: string;
  count: number;
  value: number;
  color: string;
  bgColor: string;
}

interface RiskTableProps {
  data?: RiskCategory[];
}

const defaultData: RiskCategory[] = [
  { name: "Saudável", count: 28, value: 0, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  { name: "Controlado", count: 12, value: 45000, color: "text-blue-600", bgColor: "bg-blue-50" },
  { name: "Exige Atenção", count: 8, value: 127000, color: "text-amber-600", bgColor: "bg-amber-50" },
  { name: "Crítico", count: 5, value: 285000, color: "text-red-600", bgColor: "bg-red-50" },
  { name: "Em Negociação", count: 2, value: 92000, color: "text-purple-600", bgColor: "bg-purple-50" },
];

export function RiskTable({ data = defaultData }: RiskTableProps) {
  const total = data.reduce((acc, item) => acc + item.count, 0);
  const totalValue = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50">
        <h3 className="font-semibold text-gray-900">Por Perfil de Risco</h3>
        <p className="text-sm text-gray-500 mt-0.5">Distribuição de franqueados por categoria</p>
      </div>
      <div className="p-4">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Perfil
              </th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Qtd
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Valor em Aberto
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.name} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        item.bgColor,
                        item.color
                      )}
                    >
                      {item.name}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-medium text-gray-900">{item.count}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {item.value > 0
                      ? new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          minimumFractionDigits: 0,
                        }).format(item.value)
                      : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-100 bg-gray-50/30">
              <td className="px-3 py-3">
                <span className="text-sm font-semibold text-gray-900">Total</span>
              </td>
              <td className="px-3 py-3 text-center">
                <span className="text-sm font-semibold text-gray-900">{total}</span>
              </td>
              <td className="px-3 py-3 text-right">
                <span className="text-sm font-semibold text-gray-900">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    minimumFractionDigits: 0,
                  }).format(totalValue)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
