"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChargesByMonthChartProps {
  data: Array<{
    month: string;
    emitidas: number;
    pagas: number;
    vencidas: number;
  }>;
}

export function ChargesByMonthChart({ data }: ChargesByMonthChartProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Cobranças por Mês</h3>
        <p className="text-sm text-gray-500">Acompanhe o volume de cobranças</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="colorEmitidas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#85ace6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#85ace6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorPagas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorVencidas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
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
          <Area
            type="monotone"
            dataKey="emitidas"
            name="Emitidas"
            stroke="#85ace6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorEmitidas)"
          />
          <Area
            type="monotone"
            dataKey="pagas"
            name="Pagas"
            stroke="#22c55e"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorPagas)"
          />
          <Area
            type="monotone"
            dataKey="vencidas"
            name="Vencidas"
            stroke="#ef4444"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorVencidas)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
