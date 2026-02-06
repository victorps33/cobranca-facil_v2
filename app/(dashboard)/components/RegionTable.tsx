"use client";

interface RegionData {
  name: string;
  count: number;
  value: number;
  percentage: number;
}

interface RegionTableProps {
  data?: RegionData[];
}

const defaultData: RegionData[] = [
  { name: "Sudeste", count: 22, value: 312000, percentage: 45 },
  { name: "Sul", count: 14, value: 186000, percentage: 27 },
  { name: "Nordeste", count: 10, value: 127000, percentage: 18 },
  { name: "Centro-Oeste", count: 6, value: 52000, percentage: 7 },
  { name: "Norte", count: 3, value: 15000, percentage: 3 },
];

export function RegionTable({ data = defaultData }: RegionTableProps) {
  const total = data.reduce((acc, item) => acc + item.count, 0);
  const totalValue = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50">
        <h3 className="font-semibold text-gray-900">Por Região</h3>
        <p className="text-sm text-gray-500 mt-0.5">Distribuição geográfica da carteira</p>
      </div>
      <div className="p-4">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Região
              </th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Qtd
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Valor em Aberto
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.name} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-3 py-3">
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
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
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#85ace6] rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">
                      {item.percentage}%
                    </span>
                  </div>
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
              <td className="px-3 py-3 text-right">
                <span className="text-xs text-gray-500">100%</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
