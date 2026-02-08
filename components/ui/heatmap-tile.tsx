"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ciclosHistorico } from "@/lib/data/apuracao-historico-dummy";

// ── Dados derivados do ciclo mais recente de apuração ──

const latestCiclo = ciclosHistorico[0];

const heatmapData = latestCiclo.detalhes
  .map((d) => ({
    name: d.franqueado.replace("Franquia ", ""),
    value: Math.round(d.faturamento / 100), // centavos → reais
  }))
  .sort((a, b) => b.value - a.value);

const maxValue = heatmapData[0]?.value || 1;
const dataWithPercentage = heatmapData.map((d) => ({
  ...d,
  percentage: Math.round((d.value / maxValue) * 100),
}));

// ── Cores por intensidade ──

const getBarColor = (percentage: number) => {
  if (percentage >= 80) return "#F85B00";
  if (percentage >= 60) return "#fb8c47";
  if (percentage >= 40) return "#fdb98b";
  if (percentage >= 20) return "#85ace6";
  return "#b8d4f0";
};

const fmtBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white px-4 py-3 shadow-lg rounded-xl border border-gray-100">
        <p className="text-sm font-semibold text-gray-900">{data.name}</p>
        <p className="text-lg font-bold text-gray-900 mt-1">
          {fmtBRL(data.value)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {data.percentage}% do maior faturamento
        </p>
      </div>
    );
  }
  return null;
};

// ── Componente ──

export function HeatmapTile() {
  const total = dataWithPercentage.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Concentração de Faturamento
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Distribuição por franqueado — {latestCiclo.competenciaShort}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {fmtBRL(total)}
            </p>
            <p className="text-xs text-gray-500">Faturamento total da rede</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <div style={{ height: Math.max(280, dataWithPercentage.length * 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dataWithPercentage}
              layout="vertical"
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                tickFormatter={(value) =>
                  new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    notation: "compact",
                  }).format(value)
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#374151", fontSize: 13, fontWeight: 500 }}
                width={110}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
              <Bar
                dataKey="value"
                radius={[0, 8, 8, 0]}
                barSize={28}
              >
                {dataWithPercentage.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBarColor(entry.percentage)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#b8d4f0]" />
            <span className="text-xs text-gray-500">Baixo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#85ace6]" />
            <span className="text-xs text-gray-500">Médio-baixo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#fdb98b]" />
            <span className="text-xs text-gray-500">Médio</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#fb8c47]" />
            <span className="text-xs text-gray-500">Alto</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#F85B00]" />
            <span className="text-xs text-gray-500">Muito alto</span>
          </div>
        </div>
      </div>
    </div>
  );
}
