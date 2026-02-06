"use client";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
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
}

export function ChartCard({ title, subtitle, children, action }: ChartCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
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
      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
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

// Collection Rate Chart
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
