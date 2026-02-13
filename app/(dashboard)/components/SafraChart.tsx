"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const safraData = [
  { day: "D0", jan: 0, fev: 0, mar: 0 },
  { day: "D+5", jan: 35, fev: 32, mar: 38 },
  { day: "D+10", jan: 58, fev: 55, mar: 62 },
  { day: "D+15", jan: 72, fev: 68, mar: 75 },
  { day: "D+20", jan: 81, fev: 78, mar: 84 },
  { day: "D+25", jan: 87, fev: 84, mar: 89 },
  { day: "D+30", jan: 92, fev: 89, mar: 93 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 shadow-large rounded-xl border border-gray-100">
        <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium text-gray-900">{entry.value}%</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function SafraChart() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50">
        <h3 className="font-semibold text-gray-900">Curva de Recebimento por Safra</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Evolução do recebimento ao longo do tempo por competência
        </p>
      </div>
      <div className="p-6">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={safraData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingBottom: 20 }}
              />
              <Line
                type="monotone"
                dataKey="jan"
                name="Jan/26"
                stroke="#85ace6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#85ace6" }}
              />
              <Line
                type="monotone"
                dataKey="fev"
                name="Fev/26"
                stroke="#F85B00"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#F85B00" }}
              />
              <Line
                type="monotone"
                dataKey="mar"
                name="Mar/26"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#10b981" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
