"use client";

interface FaixaData {
  faixa: string;
  count: number;
  value: number;
}

interface FaturamentoTableProps {
  data?: FaixaData[];
}

const defaultData: FaixaData[] = [
  { faixa: "Até R$ 50k", count: 8, value: 45000 },
  { faixa: "R$ 50k – 100k", count: 15, value: 125000 },
  { faixa: "R$ 100k – 200k", count: 18, value: 218000 },
  { faixa: "R$ 200k – 500k", count: 10, value: 185000 },
  { faixa: "Acima de R$ 500k", count: 4, value: 119000 },
];

export function FaturamentoTable({ data = defaultData }: FaturamentoTableProps) {
  const total = data.reduce((acc, item) => acc + item.count, 0);
  const totalValue = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50">
        <h3 className="font-semibold text-gray-900">Por Faixa de Faturamento</h3>
        <p className="text-sm text-gray-500 mt-0.5">Segmentação por volume mensal</p>
      </div>
      <div className="p-4">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Faixa
              </th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Franqueados
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Valor em Aberto
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={item.faixa} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-3 py-3">
                  <span className="text-sm font-medium text-gray-900">{item.faixa}</span>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-sm text-gray-600">{item.count}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      minimumFractionDigits: 0,
                    }).format(item.value)}
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
