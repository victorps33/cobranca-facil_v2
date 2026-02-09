"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { TooltipHint } from "@/components/ui/tooltip-hint";
import { franqueadosDummy } from "@/lib/data/clientes-dummy";
import { cobrancasDummy } from "@/lib/data/cobrancas-dummy";
import { cn } from "@/lib/cn";
import {
  MapPin,
  Phone,
  Mail,
  Building2,
  Calendar,
  User,
  AlertTriangle,
} from "lucide-react";

// ── Helpers ──

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

const fmtDate = (dateStr: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr));

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  Saudável:       { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Controlado:     { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  "Exige Atenção": { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  Crítico:        { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
};

const cobrancaStatusColors: Record<string, { bg: string; text: string }> = {
  Aberta:    { bg: "bg-blue-50",    text: "text-blue-700" },
  Vencida:   { bg: "bg-red-50",     text: "text-red-700" },
  Paga:      { bg: "bg-emerald-50", text: "text-emerald-700" },
  Cancelada: { bg: "bg-gray-100",   text: "text-gray-500" },
};

// ── Component ──

export default function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();

  const franqueado = useMemo(
    () => franqueadosDummy.find((f) => f.id === params.id) ?? null,
    [params.id]
  );

  const cobrancas = useMemo(
    () =>
      cobrancasDummy
        .filter((c) => c.clienteId === params.id)
        .sort((a, b) => b.dataVencimento.localeCompare(a.dataVencimento)),
    [params.id]
  );

  const stats = useMemo(() => {
    const vencidas = cobrancas.filter((c) => c.status === "Vencida");
    const pagas = cobrancas.filter((c) => c.status === "Paga");
    return {
      total: cobrancas.length,
      vencidas: vencidas.length,
      pagas: pagas.length,
      valorVencido: vencidas.reduce((s, c) => s + c.valorAberto, 0),
    };
  }, [cobrancas]);

  if (!franqueado) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: "Franqueados", href: "/clientes" },
          { label: "Não encontrado" },
        ]} />
        <div className="bg-white rounded-2xl border border-gray-100 px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            O franqueado com este ID não foi encontrado na base.
          </p>
          <Link
            href="/clientes"
            className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            Voltar para cadastro
          </Link>
        </div>
      </div>
    );
  }

  const sc = statusColors[franqueado.status] ?? statusColors.Saudável;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[
        { label: "Franqueados", href: "/clientes" },
        { label: franqueado.nome },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {franqueado.nome}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {franqueado.razaoSocial} · {franqueado.cnpj}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            sc.bg,
            sc.text
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
          {franqueado.status}
        </span>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          {
            label: "Emitido",
            value: fmtBRL(franqueado.valorEmitido),
            sub: `${stats.total} cobranças`,
            color: "text-gray-900",
          },
          {
            label: "Recebido",
            value: fmtBRL(franqueado.valorRecebido),
            sub: `${stats.pagas} pagas`,
            color: "text-emerald-600",
          },
          {
            label: "Em aberto",
            value: fmtBRL(franqueado.valorAberto),
            sub: `${stats.vencidas} vencidas (${fmtBRL(stats.valorVencido)})`,
            color: franqueado.valorAberto > 0 ? "text-red-600" : "text-gray-900",
          },
          {
            label: "PMR",
            value: `${franqueado.pmr} dias`,
            sub: `Inadimplência ${(franqueado.inadimplencia * 100).toFixed(1)}%`,
            color: franqueado.pmr > 20 ? "text-amber-600" : "text-gray-900",
            tooltip: "Prazo Médio de Recebimento — tempo médio entre emissão e pagamento",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-2xl border border-gray-100 p-5"
          >
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              {kpi.label}
              {"tooltip" in kpi && kpi.tooltip && (
                <TooltipHint text={kpi.tooltip as string} />
              )}
            </p>
            <p className={cn("text-lg font-semibold mt-1 tabular-nums", kpi.color)}>
              {kpi.value}
            </p>
            <p className="text-xs text-gray-500 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Informações */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Informações</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div className="flex items-center gap-3 text-gray-600">
            <User className="h-4 w-4 text-gray-400 shrink-0" />
            <span>{franqueado.responsavel}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Mail className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="truncate">{franqueado.email}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Phone className="h-4 w-4 text-gray-400 shrink-0" />
            <span>{franqueado.telefone}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
            <span>
              {franqueado.bairro}, {franqueado.cidade}/{franqueado.estado}
            </span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
            <span>Loja {franqueado.statusLoja}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
            <span>Aberta em {fmtDate(franqueado.dataAbertura)}</span>
          </div>
        </div>
      </div>

      {/* Charges table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Cobranças ({cobrancas.length})
          </h3>
        </div>

        {cobrancas.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-400">Nenhuma cobrança registrada.</p>
          </div>
        ) : (
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
                  const sc2 = cobrancaStatusColors[c.status] ?? cobrancaStatusColors.Aberta;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
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
                            sc2.bg,
                            sc2.text
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
        )}
      </div>
    </div>
  );
}
