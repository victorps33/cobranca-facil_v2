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

interface ClientsEvolutionChartProps {
  data: Array<{
    month: string;
    novos: number;
    ativos: number;
  }>;
}

export function ClientsEvolutionChart({ data }: ClientsEvolutionChartProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Evolução de Clientes</h3>
        <p className="text-sm text-gray-500">Novos clientes e base ativa</p>
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
            tick={{ fontSize: 12, fill: "#666" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e5e5" }}
            width={50}
          />
          <Tooltip 
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
            dataKey="ativos" 
            name="Clientes Ativos" 
            fill="#85ace6"
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            dataKey="novos" 
            name="Novos Clientes" 
            fill="#F85B00"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
