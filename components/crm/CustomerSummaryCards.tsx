"use client";

import { cn } from "@/lib/cn";

interface CustomerSummaryStats {
  totalVencido: number;
  valorVencido: number;
  diasInadimplente: number;
  faixaRisco: "A" | "B" | "C" | "D" | "E";
}

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

const faixaColors: Record<string, { bg: string; text: string }> = {
  A: { bg: "bg-emerald-50", text: "text-emerald-700" },
  B: { bg: "bg-blue-50",    text: "text-blue-700" },
  C: { bg: "bg-yellow-50",  text: "text-yellow-700" },
  D: { bg: "bg-orange-50",  text: "text-orange-700" },
  E: { bg: "bg-red-50",     text: "text-red-700" },
};

interface CustomerSummaryCardsProps {
  stats: CustomerSummaryStats;
}

export function CustomerSummaryCards({ stats }: CustomerSummaryCardsProps) {
  const fc = faixaColors[stats.faixaRisco] ?? faixaColors.A;

  const cards = [
    {
      label: "Cobranças Vencidas",
      value: String(stats.totalVencido),
      color: stats.totalVencido > 0 ? "text-red-600" : "text-gray-900",
    },
    {
      label: "Valor Vencido",
      value: fmtBRL(stats.valorVencido),
      color: stats.valorVencido > 0 ? "text-red-600" : "text-gray-900",
    },
    {
      label: "Dias Inadimplente",
      value: `${stats.diasInadimplente}d`,
      color: stats.diasInadimplente > 30 ? "text-amber-600" : "text-gray-900",
    },
    {
      label: "Faixa de Risco",
      value: stats.faixaRisco,
      color: fc.text,
      badgeBg: fc.bg,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-2xl border border-gray-100 p-5"
        >
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {card.label}
          </p>
          {card.badgeBg ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-lg font-bold mt-1",
                card.badgeBg,
                card.color
              )}
            >
              {card.value}
            </span>
          ) : (
            <p className={cn("text-lg font-semibold mt-1 tabular-nums", card.color)}>
              {card.value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
