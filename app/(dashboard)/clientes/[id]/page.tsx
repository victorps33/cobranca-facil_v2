"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import type { Franqueado, Cobranca } from "@/lib/types";
import { KpiSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { MetricCard } from "@/components/ui/metric-card";
import {
  MapPin,
  Phone,
  Mail,
  Building2,
  Calendar,
  User,
  AlertTriangle,
  Contact,
  DollarSign,
  TrendingUp,
  Clock,
} from "lucide-react";

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

const fmtDate = (dateStr: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr));

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  "Saudável":       { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  "Controlado":     { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  "Exige Atenção": { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  "Crítico":        { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
};

const cobrancaStatusColors: Record<string, { bg: string; text: string }> = {
  Aberta:    { bg: "bg-blue-50",    text: "text-blue-700" },
  Vencida:   { bg: "bg-red-50",     text: "text-red-700" },
  Paga:      { bg: "bg-emerald-50", text: "text-emerald-700" },
  Cancelada: { bg: "bg-gray-100",   text: "text-gray-500" },
};

export default function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [franqueado, setFranqueado] = useState<Franqueado | null>(null);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/charges").then((r) => r.json()),
    ]).then(([customers, charges]) => {
      const found = Array.isArray(customers)
        ? customers.find((f: Franqueado) => f.id === params.id) ?? null
        : null;
      setFranqueado(found);

      const clienteCharges = Array.isArray(charges)
        ? charges
            .filter((c: Cobranca) => c.clienteId === params.id)
            .sort((a: Cobranca, b: Cobranca) => b.dataVencimento.localeCompare(a.dataVencimento))
        : [];
      setCobrancas(clienteCharges);
    }).finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Franqueados", href: "/clientes" }, { label: "Carregando..." }]} />
        <KpiSkeleton count={4} />
        <TableSkeleton rows={5} cols={6} />
      </div>
    );
  }

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
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Voltar para cadastro
          </Link>
        </div>
      </div>
    );
  }

  const sc = statusColors[franqueado.status] ?? statusColors["Saudável"];

  const stats = {
    total: cobrancas.length,
    vencidas: cobrancas.filter((c) => c.status === "Vencida").length,
    pagas: cobrancas.filter((c) => c.status === "Paga").length,
    valorVencido: cobrancas.filter((c) => c.status === "Vencida").reduce((s, c) => s + c.valorAberto, 0),
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "Franqueados", href: "/clientes" },
        { label: franqueado.nome },
      ]} />

      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {franqueado.nome}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {franqueado.razaoSocial} · {franqueado.cnpj}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/crm/${franqueado.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            <Contact className="h-4 w-4" />
            Ver no CRM
          </Link>
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          title="Emitido"
          value={fmtBRL(franqueado.valorEmitido)}
          subtitle={`${stats.total} cobranças`}
          className="animate-in stagger-1"
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          title="Recebido"
          value={fmtBRL(franqueado.valorRecebido)}
          subtitle={`${stats.pagas} pagas`}
          className="animate-in stagger-2"
        />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Em Aberto"
          value={fmtBRL(franqueado.valorAberto)}
          subtitle={`${stats.vencidas} vencidas (${fmtBRL(stats.valorVencido)})`}
          variant={franqueado.valorAberto > 0 ? "danger" : "default"}
          className="animate-in stagger-3"
        />
        <MetricCard
          icon={<Clock className="h-4 w-4" />}
          title="PMR"
          value={`${franqueado.pmr} dias`}
          subtitle={`Inadimplência ${(franqueado.inadimplencia * 100).toFixed(1)}%`}
          tooltip="Prazo Médio de Recebimento — tempo médio entre emissão e pagamento"
          className="animate-in stagger-4"
        />
      </div>

      {/* Informações */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Informações</h3>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="flex items-center gap-3 text-gray-600">
            <User className="h-4 w-4 text-gray-400 shrink-0" />
            <span>{franqueado.responsavel || "—"}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Phone className="h-4 w-4 text-gray-400 shrink-0" />
            <span>{franqueado.telefone || "—"}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Mail className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="truncate">{franqueado.email}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
            <span>
              {franqueado.bairro && franqueado.cidade
                ? `${franqueado.bairro}, ${franqueado.cidade}/${franqueado.estado}`
                : "—"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
            <span>Loja {franqueado.statusLoja}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
            <span>
              {franqueado.dataAbertura
                ? `Aberta em ${fmtDate(franqueado.dataAbertura)}`
                : "—"}
            </span>
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
                  <th className="px-5 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">Descrição</th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">Categoria</th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">Vencimento</th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide text-right">Valor</th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide text-right">Aberto</th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">Pagamento</th>
                  <th className="px-4 py-3 font-medium text-xs text-gray-400 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((c) => {
                  const sc2 = cobrancaStatusColors[c.status] ?? cobrancaStatusColors.Aberta;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/cobrancas/${c.id}`)}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">{c.descricao}</p>
                        <p className="text-xs text-gray-400">{c.competencia}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.categoria}</td>
                      <td className="px-4 py-3 text-gray-600 tabular-nums">{fmtDate(c.dataVencimento)}</td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums font-medium">{fmtBRL(c.valorOriginal)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={c.valorAberto > 0 ? "text-red-600 font-medium" : "text-gray-400"}>
                          {c.valorAberto > 0 ? fmtBRL(c.valorAberto) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.formaPagamento}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", sc2.bg, sc2.text)}>
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
