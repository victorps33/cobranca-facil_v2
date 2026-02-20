"use client";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function ChartCard({ title, subtitle, children, action, compact, className }: ChartCardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden h-full flex flex-col ${className ?? ""}`}>
      <div className={`${compact ? "px-4 py-3" : "px-6 py-4"} border-b border-gray-50 flex items-center justify-between`}>
        <div>
          <h3 className={`font-semibold text-gray-900 ${compact ? "text-sm" : ""}`}>{title}</h3>
          {subtitle && <p className={`text-gray-500 mt-0.5 ${compact ? "text-xs" : "text-sm"}`}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={`${compact ? "p-4" : "p-6"} flex-1`}>{children}</div>
    </div>
  );
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-large text-sm">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="font-medium">
            {entry.name}: {typeof entry.value === "number" && entry.value > 100
              ? formatCurrency(entry.value)
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Revenue Line Chart - Stripe style
interface RevenueChartProps {
  data: Array<{
    month: string;
    revenue: number;
    projected?: number;
  }>;
}

export function StripeRevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#85ace6" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#85ace6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          tickFormatter={formatCurrency}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Receita"
          stroke="#85ace6"
          strokeWidth={2.5}
          fill="url(#revenueGradient)"
          dot={false}
          activeDot={{ r: 6, fill: "#85ace6", stroke: "#fff", strokeWidth: 2 }}
        />
        {data.some(d => d.projected) && (
          <Area
            type="monotone"
            dataKey="projected"
            name="Projetado"
            stroke="#d1d5db"
            strokeWidth={2}
            strokeDasharray="5 5"
            fill="transparent"
            dot={false}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Payment Methods Bar Chart
interface PaymentMethodsChartProps {
  data: Array<{
    month: string;
    boleto: number;
    pix: number;
    cartao: number;
  }>;
}

export function StripePaymentMethodsChart({ data }: PaymentMethodsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="0" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          tickFormatter={formatCurrency}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="boleto" name="Boleto" fill="#85ace6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pix" name="Pix" fill="#F85B00" radius={[4, 4, 0, 0]} />
        <Bar dataKey="cartao" name="Cartão" fill="#6b7280" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Charges Status Chart
interface ChargesStatusChartProps {
  data: Array<{
    month: string;
    pagas: number;
    pendentes: number;
    vencidas: number;
  }>;
}

export function StripeChargesStatusChart({ data }: ChargesStatusChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="0" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="pagas" name="Pagas" stackId="a" fill="#85ace6" radius={[0, 0, 0, 0]} />
        <Bar dataKey="pendentes" name="Pendentes" stackId="a" fill="#F85B00" radius={[0, 0, 0, 0]} />
        <Bar dataKey="vencidas" name="Vencidas" stackId="a" fill="#374151" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Collection Rate Chart (legacy)
interface CollectionRateChartProps {
  data: Array<{
    month: string;
    rate: number;
    target: number;
  }>;
}

export function StripeCollectionRateChart({ data }: CollectionRateChartProps) {
  const avgTarget = data.reduce((acc, d) => acc + d.target, 0) / data.length;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="0" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          width={40}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={avgTarget}
          stroke="#d1d5db"
          strokeDasharray="5 5"
          label={{ value: "Meta", position: "right", fill: "#9ca3af", fontSize: 11 }}
        />
        <Line
          type="monotone"
          dataKey="rate"
          name="Taxa de Recebimento"
          stroke="#85ace6"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 6, fill: "#85ace6", stroke: "#fff", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Curva de Recebimento por Safra
interface SafraCurveChartProps {
  data: Array<Record<string, number | string | undefined>>;
  safras: Array<{ key: string; label: string; color: string }>;
}

const SafraCurveTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const entries = payload.filter((e: any) => e.value != null);
    if (entries.length === 0) return null;
    return (
      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-large text-sm">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        {entries.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-medium">
              {entry.name}: {entry.value}%
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function SafraCurveChart({ data, safras }: SafraCurveChartProps) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            width={40}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<SafraCurveTooltip />} />
          <ReferenceLine
            y={90}
            stroke="#d1d5db"
            strokeDasharray="5 5"
            label={{ value: "Meta 90%", position: "right", fill: "#9ca3af", fontSize: 10 }}
          />
          {safras.map((safra) => (
            <Line
              key={safra.key}
              type="monotone"
              dataKey={safra.key}
              name={safra.label}
              stroke={safra.color}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 5, fill: safra.color, stroke: "#fff", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 px-1">
        {safras.map((safra) => (
          <div key={safra.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: safra.color }}
            />
            <span className="text-[11px] text-gray-500">{safra.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Aging List Chart ──

const AGING_COLORS: Record<string, string> = {
  "0-30d": "#85ace6",
  "31-60d": "#F85B00",
  "61-90d": "#8b5cf6",
  "91+d": "#374151",
};

interface AgingListChartProps {
  data: Array<{ bucket: string; valor: number; count: number }>;
}

const AgingTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-large text-sm">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        <p className="font-medium">{formatCurrency(payload[0].value)}</p>
        <p className="text-gray-400 text-xs">{payload[0].payload.count} cobranças</p>
      </div>
    );
  }
  return null;
};

export function AgingListChart({ data }: AgingListChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="0" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="bucket"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          tickFormatter={formatCurrency}
          width={70}
        />
        <Tooltip content={<AgingTooltip />} />
        <Bar dataKey="valor" name="Valor" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={AGING_COLORS[entry.bucket] || "#6b7280"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Forecast vs Actual Chart ──

interface ForecastVsActualChartProps {
  data: Array<{ month: string; recebido: number; previsto: number }>;
}

export function ForecastVsActualChart({ data }: ForecastVsActualChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="recebidoGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          tickFormatter={formatCurrency}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="previsto"
          name="Previsto"
          stroke="#d1d5db"
          strokeWidth={2}
          strokeDasharray="5 5"
          fill="transparent"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="recebido"
          name="Recebido"
          stroke="#10b981"
          strokeWidth={2.5}
          fill="url(#recebidoGradient)"
          dot={false}
          activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── PMR Trend Chart ──

interface PmrTrendChartProps {
  data: Array<{ month: string; pmr: number }>;
}

export function PmrTrendChart({ data }: PmrTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="0" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          width={40}
          tickFormatter={(v) => `${v}d`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={15}
          stroke="#d1d5db"
          strokeDasharray="5 5"
          label={{ value: "Meta 15d", position: "right", fill: "#9ca3af", fontSize: 11 }}
        />
        <Line
          type="monotone"
          dataKey="pmr"
          name="PMR"
          stroke="#F85B00"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 6, fill: "#F85B00", stroke: "#fff", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Receipt Rate Chart ──

interface ReceiptRateChartProps {
  data: Array<{ month: string; rate: number }>;
}

export function ReceiptRateChart({ data }: ReceiptRateChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          width={40}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={85}
          stroke="#d1d5db"
          strokeDasharray="5 5"
          label={{ value: "Meta 85%", position: "right", fill: "#9ca3af", fontSize: 11 }}
        />
        <Area
          type="monotone"
          dataKey="rate"
          name="Taxa de Recebimento"
          stroke="#8b5cf6"
          strokeWidth={2.5}
          fill="url(#rateGradient)"
          dot={false}
          activeDot={{ r: 6, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Chart Legend
export function ChartLegend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div className="flex items-center gap-4 mt-4">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-gray-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
