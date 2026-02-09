"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { cobrancasDummy } from "@/lib/data/cobrancas-dummy";
import { ciclosHistorico } from "@/lib/data/apuracao-historico-dummy";
import { franqueadosDummy } from "@/lib/data/clientes-dummy";
import {
  ArrowLeft,
  Copy,
  ChevronDown,
  FileText,
  MessageCircle,
  HelpCircle,
  QrCode,
  Check,
  Info,
  CornerDownLeft,
  Barcode,
} from "lucide-react";
import { FRANQUEADORA, fmt, fmtDate } from "@/lib/constants";
import { NotaFiscalViewerDialog } from "@/components/cobrancas/NotaFiscalViewerDialog";
import { BoletoViewerDialog } from "@/components/cobrancas/BoletoViewerDialog";
import { PixComprovanteDialog } from "@/components/cobrancas/PixComprovanteDialog";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  Aberta: {
    label: "Em aberto",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  Vencida: {
    label: "Vencida",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  Paga: {
    label: "Paga",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  Cancelada: {
    label: "Cancelada",
    className: "bg-gray-100 text-gray-500 border-gray-200",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function relativeDate(
  dueDateIso: string,
  status: string,
  payDateIso?: string,
): string {
  if (status === "Paga" && payDateIso) return `Paga em ${fmtDate(payDateIso)}`;
  const today = new Date("2026-02-07T12:00:00");
  const due = new Date(dueDateIso + "T12:00:00");
  const diff = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff > 1) return `Em ${diff} dias.`;
  if (diff === 1) return "Em um dia.";
  if (diff === 0) return "Vence hoje.";
  const abs = Math.abs(diff);
  return `Vencida há ${abs} dia${abs > 1 ? "s" : ""}.`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CobrancaDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [paymentTab, setPaymentTab] = useState<"pix" | "boleto">("pix");
  const [calculoOpen, setCalculoOpen] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [nfViewerOpen, setNfViewerOpen] = useState(false);
  const [boletoViewerOpen, setBoletoViewerOpen] = useState(false);
  const [pixComprovanteOpen, setPixComprovanteOpen] = useState(false);

  const cobranca = cobrancasDummy.find((c) => c.id === params.id);

  if (!cobranca) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <div className="text-center space-y-3">
          <p className="text-lg font-medium text-gray-900">
            Cobrança não encontrada
          </p>
          <p className="text-sm text-gray-500">
            A cobrança &quot;{params.id}&quot; não existe.
          </p>
          <Link
            href="/cobrancas"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar à lista
          </Link>
        </div>
      </div>
    );
  }

  const franqueado = franqueadosDummy.find((f) => f.id === cobranca.clienteId);
  const ciclo = ciclosHistorico.find(
    (c) => c.competencia === cobranca.competencia,
  );
  const detalhe = ciclo?.detalhes.find(
    (d) => d.franqueado === cobranca.cliente,
  );

  const pixCode = `00020101021226840014br.gov.bcb.pix2562qrcode.cobrancafacil.com/v2/cobv/${cobranca.id}`;
  const vencNum = cobranca.dataVencimento.replace(/-/g, "");
  const valorNum = String(cobranca.valorOriginal).padStart(10, "0");
  const linhaDigitavel = `23793.38128 60000.000003 00000.000401 1 ${vencNum}${valorNum}`;

  const badge = STATUS_BADGE[cobranca.status] ?? STATUS_BADGE.Aberta;

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div className="space-y-5">
      {/* ── Voltar ── */}
      <Link
        href="/cobrancas"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ChevronDown className="h-4 w-4 rotate-90" />
        Voltar à lista
      </Link>

      {/* ── Grid 2 colunas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* ================================================ */}
        {/* COLUNA PRINCIPAL                                  */}
        {/* ================================================ */}
        <div className="space-y-6">
          {/* ── Card único: Detalhes + Franqueado + Financeiro ── */}
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm">
            {/* — Header — */}
            <div className="px-8 pt-8 pb-0">
              <div className="flex items-start justify-between mb-1">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Detalhes da fatura
                </h1>
                <span
                  className={cn(
                    "px-3.5 py-1 text-xs font-semibold rounded-full border",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              </div>

              {/* ID */}
              <div className="flex items-center gap-1.5 mb-8">
                <span className="text-sm text-gray-400">
                  ID #{cobranca.id}
                </span>
                <button
                  onClick={() => copy(cobranca.id, "id")}
                  className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
                  aria-label="Copiar ID"
                >
                  {copiedField === "id" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* — Resumo 3 colunas — */}
              <div className="grid grid-cols-3 gap-6 mb-6">
                {/* Valor */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Valor a pagar</p>
                  <p className="text-[2rem] leading-none font-bold text-gray-900 tracking-tight tabular-nums">
                    {fmt(cobranca.valorOriginal)}
                  </p>
                </div>
                {/* Vencimento */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Vencimento</p>
                  <p className="text-xl font-bold text-gray-900 tabular-nums">
                    {fmtDate(cobranca.dataVencimento)}
                  </p>
                  <p
                    className={cn(
                      "text-sm mt-0.5",
                      cobranca.status === "Vencida"
                        ? "text-red-500"
                        : cobranca.status === "Paga"
                          ? "text-emerald-600"
                          : "text-gray-400",
                    )}
                  >
                    {relativeDate(
                      cobranca.dataVencimento,
                      cobranca.status,
                      cobranca.dataPagamento,
                    )}
                  </p>
                </div>
                {/* Competência */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Competência</p>
                  <p className="text-xl font-bold text-gray-900">
                    {cobranca.competencia}
                  </p>
                </div>
              </div>

              {/* Botão "Entenda esse valor" */}
              <button
                onClick={() => {
                  const el = document.getElementById("secao-calculo");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors mb-8"
              >
                <Info className="h-4 w-4 text-gray-400" />
                Entenda esse valor
              </button>
            </div>

            {/* — Franqueado / Franqueadora — */}
            <div className="border-t border-gray-100" />
            <div className="px-8 py-7 grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-xs text-gray-400 mb-2">Franqueado</p>
                <p className="text-sm font-semibold text-gray-900 leading-snug">
                  {cobranca.cliente}
                </p>
                {franqueado && (
                  <>
                    <p className="text-sm text-gray-500">
                      {franqueado.razaoSocial}
                    </p>
                    <p className="text-sm text-gray-500 tabular-nums">
                      {franqueado.cnpj}
                    </p>
                  </>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-400 mb-2">Franqueadora</p>
                <p className="text-sm font-semibold text-gray-900">
                  {FRANQUEADORA.nome}
                </p>
                <p className="text-sm text-gray-500">
                  {FRANQUEADORA.razaoSocial}
                </p>
                <p className="text-sm text-gray-500 tabular-nums">
                  {FRANQUEADORA.cnpj}
                </p>
              </div>
            </div>

            {/* — Detalhes financeiros — */}
            <div className="border-t border-gray-100" />
            <div className="px-8 py-6 grid grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Valor original</p>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">
                  {fmt(cobranca.valorOriginal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Parcela</p>
                <p className="text-sm font-semibold text-gray-900">1/1</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Multa</p>
                <p className="text-sm font-semibold text-gray-900">2%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Juros</p>
                <p className="text-sm font-semibold text-gray-900">
                  1% ao mês.
                </p>
              </div>
            </div>
          </div>

          {/* ── Seção Cálculo ── */}
          <div
            id="secao-calculo"
            className="bg-white rounded-2xl border border-gray-200/60 shadow-sm"
          >
            {/* Header colapsável */}
            <button
              onClick={() => setCalculoOpen(!calculoOpen)}
              className="w-full flex items-center justify-between px-8 py-6 group"
            >
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                Cálculo
              </h2>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-gray-400 transition-transform duration-200",
                  calculoOpen && "rotate-180",
                )}
              />
            </button>

            {calculoOpen && (
              <>
                <div className="mx-8 border-t border-gray-100" />
                <div className="px-8 pt-5 pb-8 space-y-0">
                  {detalhe ? (
                    <>
                      {/* Faturamento apurado */}
                      <div className="flex items-center justify-between py-4 border-b border-gray-100">
                        <span className="text-sm text-gray-600">
                          Faturamento apurado
                        </span>
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          {fmt(detalhe.faturamento)}
                        </span>
                      </div>

                      {/* Royalties */}
                      <div className="flex items-center justify-between py-4 border-b border-gray-100">
                        <div className="flex items-baseline gap-3">
                          <span className="text-sm text-gray-600">
                            Taxa de Royalties
                          </span>
                          <span className="text-sm text-gray-400">4%</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          {fmt(detalhe.royalties)}
                        </span>
                      </div>

                      {/* Marketing */}
                      <div className="flex items-center justify-between py-4 border-b border-gray-100">
                        <div className="flex items-baseline gap-3">
                          <span className="text-sm text-gray-600">
                            Taxa de Marketing
                          </span>
                          <span className="text-sm text-gray-400">2%</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          {fmt(detalhe.marketing)}
                        </span>
                      </div>

                      {/* Treinamento BB2 */}
                      <div className="flex items-center justify-between py-4 border-b border-gray-100">
                        <div className="flex items-baseline gap-3">
                          <span className="text-sm text-gray-600">
                            Treinamento BB2
                          </span>
                          <span className="text-sm text-gray-400">
                            Brilhante no básico
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          R$ 1.200,00
                        </span>
                      </div>

                      {/* Crédito */}
                      <div className="flex items-center justify-between py-4 border-b border-gray-100">
                        <div className="flex items-baseline gap-3">
                          <span className="text-sm text-teal-600">
                            Crédito
                          </span>
                          <span className="text-sm text-gray-400">
                            Correção de ciclo anterior
                          </span>
                        </div>
                        <span className="text-sm font-medium text-teal-600 tabular-nums">
                          − R$ 52,00
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between py-4 border-b border-gray-100">
                        <span className="text-sm text-gray-600">
                          {cobranca.descricao}
                        </span>
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          {fmt(cobranca.valorOriginal)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 pt-2 pb-2">
                        Cobrança avulsa — sem dados de apuração vinculados.
                      </p>
                    </>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between pt-6 mt-2">
                    <span className="text-base font-bold text-gray-900">
                      Valor a pagar
                    </span>
                    <span className="text-base font-bold text-gray-900 tabular-nums">
                      {fmt(cobranca.valorOriginal)}
                    </span>
                  </div>

                  {/* Contestar */}
                  <div className="pt-6">
                    <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors">
                      <CornerDownLeft className="h-4 w-4 text-gray-400" />
                      Contestar cálculo
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ================================================ */}
        {/* SIDEBAR                                           */}
        {/* ================================================ */}
        <div className="space-y-6 lg:sticky lg:top-6">
          {/* ── Card Pagamento ── */}
          <div className="bg-[#E8EFF9] rounded-2xl p-6 space-y-5">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">
              Pague em dia e siga fluindo
            </h3>

            {/* Tabs Pix / Boleto */}
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentTab("pix")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full border transition-colors",
                  paymentTab === "pix"
                    ? "bg-white text-gray-900 border-gray-200 shadow-sm"
                    : "bg-transparent text-gray-500 border-transparent hover:bg-white/50",
                )}
              >
                <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                Pix
              </button>
              <button
                onClick={() => setPaymentTab("boleto")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full border transition-colors",
                  paymentTab === "boleto"
                    ? "bg-white text-gray-900 border-gray-200 shadow-sm"
                    : "bg-transparent text-gray-500 border-transparent hover:bg-white/50",
                )}
              >
                <Barcode className="h-3.5 w-3.5" />
                Boleto bancário
              </button>
            </div>

            {/* Conteúdo Pix */}
            {paymentTab === "pix" ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Agora é só escanear o QR Code ou copiar e colar o código Pix
                  no app do seu banco.
                </p>

                {/* QR code + código lado a lado */}
                <div className="flex gap-3">
                  <div className="w-[130px] h-[130px] bg-white rounded-xl border border-gray-200/60 flex items-center justify-center shrink-0">
                    <QrCode className="h-16 w-16 text-gray-800" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white/70 rounded-xl p-3 border border-gray-200/40 h-full flex items-start">
                      <code className="text-xs text-gray-500 break-all leading-relaxed line-clamp-5">
                        {pixCode}
                      </code>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => copy(pixCode, "pix")}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {copiedField === "pix" ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    "Copiar código Pix"
                  )}
                </button>

              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Copie a linha digitável e pague pelo app do seu banco ou em
                  qualquer lotérica.
                </p>

                <div className="bg-white/70 rounded-xl p-4 border border-gray-200/40">
                  <code className="text-xs text-gray-500 break-all leading-relaxed">
                    {linhaDigitavel}
                  </code>
                </div>

                <button
                  onClick={() => copy(linhaDigitavel, "boleto")}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {copiedField === "boleto" ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    "Copiar linha digitável"
                  )}
                </button>

              </div>
            )}

            {/* Links */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => setNfViewerOpen(true)}
                className="flex items-center gap-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Baixar nota fiscal
              </button>
              {paymentTab === "boleto" ? (
                <button
                  onClick={() => setBoletoViewerOpen(true)}
                  className="flex items-center gap-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <Barcode className="h-4 w-4" />
                  Ver boleto
                </button>
              ) : (
                <button
                  onClick={() => setPixComprovanteOpen(true)}
                  className="flex items-center gap-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <QrCode className="h-4 w-4" />
                  Ver invoice PIX
                </button>
              )}
              <button className="flex items-center gap-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                <MessageCircle className="h-4 w-4" />
                Negociar fatura
              </button>
            </div>
          </div>

          {/* ── Ajuda ── */}
          <div className="px-1 space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              Precisando de ajuda?
            </h3>
            <div className="space-y-3">
              {[
                "Os valores do boleto estão errados. O que fazer?",
                "Como falar com a Menlo?",
                "O valor da Nota Fiscal está diferente. E agora?",
              ].map((q) => (
                <a
                  key={q}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="flex items-start gap-2.5 group"
                >
                  <HelpCircle className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors leading-snug">
                    {q}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <NotaFiscalViewerDialog
        open={nfViewerOpen}
        onOpenChange={setNfViewerOpen}
        cobranca={cobranca}
        franqueado={franqueado}
        detalhe={detalhe}
      />
      <BoletoViewerDialog
        open={boletoViewerOpen}
        onOpenChange={setBoletoViewerOpen}
        cobranca={cobranca}
        franqueado={franqueado}
      />
      <PixComprovanteDialog
        open={pixComprovanteOpen}
        onOpenChange={setPixComprovanteOpen}
        cobranca={cobranca}
        franqueado={franqueado}
      />
    </div>
  );
}
