"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, QrCode, Copy, Check, Printer } from "lucide-react";
import type { Cobranca } from "@/lib/data/cobrancas-dummy";
import type { Franqueado } from "@/lib/data/clientes-dummy";
import {
  getInvoicePixByCobranca,
  getComprovantePixByCobranca,
} from "@/lib/data/documentos-dummy";
import { FRANQUEADORA, fmt, fmtDate } from "@/lib/constants";

interface PixComprovanteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobranca: Cobranca | null;
  franqueado?: Franqueado | null;
}

export function PixComprovanteDialog({
  open,
  onOpenChange,
  cobranca,
  franqueado,
}: PixComprovanteDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!cobranca) return null;

  // Use centralized dummy data
  const invoice = getInvoicePixByCobranca(cobranca.id);
  const comprovante = getComprovantePixByCobranca(cobranca.id);

  const pixCode = invoice?.qrCodePayload
    ?? `00020101021226840014br.gov.bcb.pix2562qrcode.cobrancafacil.com/v2/cobv/${cobranca.id}`;
  const txId = invoice?.txId
    ?? cobranca.id.replace(/-/g, "").slice(0, 25).toUpperCase();
  const dataPagamento = comprovante?.dataPagamento ?? cobranca.dataPagamento ?? cobranca.dataVencimento;
  const horaPagamento = comprovante?.horaPagamento ?? "14:32:18";
  const endToEndId = comprovante?.endToEndId ?? invoice?.endToEndId ?? null;
  const chavePix = invoice?.chavePix ?? FRANQUEADORA.cnpj;
  const isPago = cobranca.status === "Paga";

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{isPago ? "Comprovante Pix" : "Cobrança Pix"}</DialogTitle>
          <DialogDescription>
            {isPago ? "Comprovante de pagamento" : "Invoice"} Pix da cobrança #{cobranca.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── Header centralizado ── */}
          <div className="flex flex-col items-center gap-3 pt-2">
            {isPago ? (
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            ) : (
              <QrCode className="h-12 w-12 text-violet-500" />
            )}
            <h2 className="text-xl font-bold text-gray-900">
              {isPago ? "Comprovante de Pagamento Pix" : "Cobrança Pix"}
            </h2>
            <p className="text-sm text-gray-500">
              {fmtDate(dataPagamento)}
              {comprovante && ` às ${horaPagamento}`}
            </p>
          </div>

          {/* ── Valor ── */}
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 tabular-nums">
              {fmt(isPago ? (comprovante?.valorPago ?? cobranca.valorPago) : cobranca.valorOriginal)}
            </p>
            {isPago && (
              <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                Pagamento confirmado
              </span>
            )}
          </div>

          {/* ── QR Code placeholder ── */}
          <div className="flex justify-center">
            <div className="w-40 h-40 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2">
              <QrCode className="h-16 w-16 text-gray-400" />
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                QR Code
              </span>
            </div>
          </div>

          {/* ── Detalhes ── */}
          <div className="bg-gray-50 rounded-xl p-5 space-y-3">
            <Row
              label="Beneficiário"
              value={comprovante?.recebedor.nome ?? invoice?.beneficiario.razaoSocial ?? FRANQUEADORA.razaoSocial}
            />
            <Row
              label="CNPJ Beneficiário"
              value={comprovante?.recebedor.cnpj ?? invoice?.beneficiario.cnpj ?? FRANQUEADORA.cnpj}
            />
            {comprovante && (
              <>
                <Row label="Banco recebedor" value={comprovante.recebedor.banco} />
                <Row label="Agência / Conta" value={`${comprovante.recebedor.agencia} / ${comprovante.recebedor.conta}`} />
              </>
            )}
            <div className="border-t border-gray-200" />
            <Row
              label="Pagador"
              value={comprovante?.pagador.nome ?? invoice?.pagador.razaoSocial ?? franqueado?.razaoSocial ?? cobranca.cliente}
            />
            <Row
              label="CNPJ Pagador"
              value={comprovante?.pagador.cnpj ?? invoice?.pagador.cnpj ?? franqueado?.cnpj ?? "—"}
            />
            {comprovante && (
              <>
                <Row label="Banco pagador" value={comprovante.pagador.banco} />
                <Row label="Agência / Conta" value={`${comprovante.pagador.agencia} / ${comprovante.pagador.conta}`} />
              </>
            )}
            <div className="border-t border-gray-200" />
            <Row label="Chave Pix" value={chavePix} />
            <Row label={isPago ? "Data do pagamento" : "Data de criação"} value={fmtDate(dataPagamento)} />
            {endToEndId && <Row label="End-to-End ID" value={endToEndId} mono />}
            <Row label="ID da transação" value={txId} mono />
            <Row label="Descrição" value={cobranca.descricao} />
            {invoice?.infoAdicionais && invoice.infoAdicionais.length > 0 && (
              <>
                <div className="border-t border-gray-200" />
                {invoice.infoAdicionais.map((info, i) => (
                  <Row key={i} label={info.nome} value={info.valor} />
                ))}
              </>
            )}
          </div>

          {/* ── Autenticação (se comprovante) ── */}
          {comprovante && (
            <div className="bg-emerald-50 rounded-xl p-4 space-y-1">
              <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">
                Código de autenticação
              </p>
              <p className="font-mono text-xs text-emerald-700 tracking-wider">
                {comprovante.autenticacao}
              </p>
            </div>
          )}

          {/* ── Código Pix ── */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">
              Código Pix Copia e Cola
            </p>
            <code className="block text-xs text-gray-600 break-all leading-relaxed font-mono">
              {pixCode}
            </code>
            <button
              onClick={() => copy(pixCode)}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar código
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 transition-colors"
          >
            Fechar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span
        className={`text-sm font-medium text-gray-900 text-right ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
