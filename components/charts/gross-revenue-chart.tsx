"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface GrossRevenueChartProps {
  data: Array<{
    month: string;
    revenue: number;
    movingAverage: number;
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

export function GrossRevenueChart({ data }: GrossRevenueChartProps) {
  const average = data.reduce((acc, item) => acc + item.revenue, 0) / data.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Receita Bruta</h3>
        <p className="text-sm text-gray-500">Evolução mensal com média móvel</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
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
            formatter={(value: number) => [formatCurrency(value), ""]}
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
          <ReferenceLine 
            y={average} 
            stroke="#999" 
            strokeDasharray="5 5" 
            label={{ value: "Média", position: "right", fill: "#999", fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            name="Receita Bruta"
            stroke="#85ace6"
            strokeWidth={3}
            dot={{ fill: "#85ace6", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: "#85ace6" }}
          />
          <Line
            type="monotone"
            dataKey="movingAverage"
            name="Média Móvel (3m)"
            stroke="#F85B00"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
