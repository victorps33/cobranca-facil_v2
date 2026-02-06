"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  ChevronRight,
  RefreshCw,
  Lightbulb,
  Target,
  Clock,
} from "lucide-react";

interface Insight {
  id: string;
  type: "success" | "warning" | "info" | "action";
  icon: React.ReactNode;
  title: string;
  description: string;
  metric?: string;
  action?: {
    label: string;
    href: string;
  };
}

const mockInsights: Insight[] = [
  {
    id: "1",
    type: "success",
    icon: <TrendingUp className="h-4 w-4" />,
    title: "Taxa de recebimento em alta",
    description: "Seus recebimentos aumentaram 12% este mês comparado ao anterior.",
    metric: "+12%",
    action: { label: "Ver relatório", href: "/relatorios" },
  },
  {
    id: "2",
    type: "warning",
    icon: <AlertTriangle className="h-4 w-4" />,
    title: "3 clientes com pagamento atrasado",
    description: "Considere enviar um lembrete personalizado para acelerar o recebimento.",
    action: { label: "Ver clientes", href: "/clientes" },
  },
  {
    id: "3",
    type: "action",
    icon: <Target className="h-4 w-4" />,
    title: "Sugestão: Ajuste na régua",
    description: "Clientes VIP respondem melhor a lembretes por WhatsApp. Considere ativar.",
    action: { label: "Configurar régua", href: "/reguas" },
  },
  {
    id: "4",
    type: "info",
    icon: <Clock className="h-4 w-4" />,
    title: "5 cobranças vencem esta semana",
    description: "Total de R$ 4.250,00 a receber nos próximos 7 dias.",
    metric: "R$ 4.250",
    action: { label: "Ver cobranças", href: "/cobrancas" },
  },
];

const typeStyles = {
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    icon: "text-emerald-600",
    metric: "text-emerald-600",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-100",
    icon: "text-amber-600",
    metric: "text-amber-600",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    icon: "text-blue-600",
    metric: "text-blue-600",
  },
  action: {
    bg: "bg-violet-50",
    border: "border-violet-100",
    icon: "text-violet-600",
    metric: "text-violet-600",
  },
};

export function AIInsightsWidget() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(mockInsights);

  const refresh = () => {
    setLoading(true);
    setTimeout(() => {
      setInsights([...mockInsights].sort(() => Math.random() - 0.5));
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Insights de IA</h3>
            <p className="text-xs text-gray-500">Atualizado agora</p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4 text-gray-400", loading && "animate-spin")} />
        </button>
      </div>

      {/* Insights List */}
      <div className="divide-y divide-gray-50">
        {insights.slice(0, 4).map((insight) => {
          const styles = typeStyles[insight.type];
          return (
            <div
              key={insight.id}
              className="px-6 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    styles.bg
                  )}
                >
                  <span className={styles.icon}>{insight.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {insight.title}
                    </h4>
                    {insight.metric && (
                      <span className={cn("text-sm font-semibold", styles.metric)}>
                        {insight.metric}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {insight.description}
                  </p>
                  {insight.action && (
                    <a
                      href={insight.action.href}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 mt-2 group-hover:translate-x-0.5 transition-transform"
                    >
                      {insight.action.label}
                      <ChevronRight className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-50">
        <button className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Ver todos os insights →
        </button>
      </div>
    </div>
  );
}
