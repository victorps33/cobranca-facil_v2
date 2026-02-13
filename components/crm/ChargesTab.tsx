"use client";

import { cn } from "@/lib/cn";
import type { Cobranca } from "@/lib/types";

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

const fmtDate = (dateStr: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr));

const cobrancaStatusColors: Record<string, { bg: string; text: string }> = {
  Aberta:    { bg: "bg-blue-50",    text: "text-blue-700" },
  Vencida:   { bg: "bg-red-50",     text: "text-red-700" },
  Paga:      { bg: "bg-emerald-50", text: "text-emerald-700" },
  Cancelada: { bg: "bg-gray-100",   text: "text-gray-500" },
};

interface ChargesTabProps {
  cobrancas: Cobranca[];
}

export function ChargesTab({ cobrancas }: ChargesTabProps) {
  if (cobrancas.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-gray-400">Nenhuma cobrança registrada.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">
          Cobranças ({cobrancas.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                Descrição
              </th>
              <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                Categoria
              </th>
              <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                Vencimento
              </th>
              <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide text-right">
                Valor
              </th>
              <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide text-right">
                Aberto
              </th>
              <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                Pagamento
              </th>
              <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {cobrancas.map((c) => {
              const sc = cobrancaStatusColors[c.status] ?? cobrancaStatusColors.Aberta;
              return (
                <tr
                  key={c.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-[200px]">
                      {c.descricao}
                    </p>
                    <p className="text-xs text-gray-400">{c.competencia}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.categoria}</td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">
                    {fmtDate(c.dataVencimento)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 tabular-nums font-medium">
                    {fmtBRL(c.valorOriginal)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={
                        c.valorAberto > 0
                          ? "text-red-600 font-medium"
                          : "text-gray-400"
                      }
                    >
                      {c.valorAberto > 0 ? fmtBRL(c.valorAberto) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.formaPagamento}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        sc.bg,
                        sc.text
                      )}
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
