"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface RevenueByTypeChartProps {
  data: Array<{
    month: string;
    boleto: number;
    pix: number;
    cartao: number;
    outros: number;
  }>;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

const COLORS = {
  boleto: "#85ace6",
  pix: "#F85B00",
  cartao: "#22c55e",
  outros: "#999999",
};

export function RevenueByTypeChart({ data }: RevenueByTypeChartProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Receita por Tipo de Pagamento</h3>
        <p className="text-sm text-gray-500">Comparativo mensal por forma de pagamento</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 12, fill: "#666" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e5e5" }}
          />
          <YAxis 
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12, fill: "#666" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e5e5" }}
            width={80}
          />
          <Tooltip 
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: "20px" }}
          />
          <Bar 
            dataKey="boleto" 
            name="Boleto" 
            stackId="a" 
            fill={COLORS.boleto}
            radius={[0, 0, 0, 0]}
          />
          <Bar 
            dataKey="pix" 
            name="Pix" 
            stackId="a" 
            fill={COLORS.pix}
            radius={[0, 0, 0, 0]}
          />
          <Bar 
            dataKey="cartao" 
            name="Cartão" 
            stackId="a" 
            fill={COLORS.cartao}
            radius={[0, 0, 0, 0]}
          />
          <Bar 
            dataKey="outros" 
            name="Outros" 
            stackId="a" 
            fill={COLORS.outros}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
