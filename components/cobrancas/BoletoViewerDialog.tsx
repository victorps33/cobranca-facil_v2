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
import { Copy, Check, Printer } from "lucide-react";
import type { Cobranca, Franqueado } from "@/lib/types";
import { fmt, fmtDate } from "@/lib/constants";

interface BoletoViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobranca: Cobranca | null;
  franqueado?: Franqueado | null;
}

export function BoletoViewerDialog({
  open,
  onOpenChange,
  cobranca,
  franqueado,
}: BoletoViewerDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!cobranca) return null;

  const vencNum = cobranca.dataVencimento.replace(/-/g, "");
  const valorNum = String(cobranca.valorOriginal).padStart(10, "0");
  const linhaDigitavel = `23793.38128 60000.000003 00000.000401 1 ${vencNum}${valorNum}`;

  const bancoNum = "237";
  const bancoNome = "Bradesco";
  const agenciaConta = "0237 / 12345-6";
  const nossoNumero = `237/${cobranca.id.slice(0, 11).toUpperCase()}`;
  const numDocumento = cobranca.id.slice(0, 8).toUpperCase();

  const instrucoes = [
    "Após o vencimento, cobrar multa de 2% sobre o valor do documento e juros de mora de 1% ao mês.",
    "Não receber após 30 dias do vencimento.",
  ];

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Boleto Bancário</DialogTitle>
          <DialogDescription>
            Visualização do boleto para a cobrança #{cobranca.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-0 border border-gray-300 rounded-lg overflow-hidden text-sm">
          {/* ── Header do banco ── */}
          <div className="flex items-center border-b border-gray-300">
            <div className="px-4 py-3 border-r border-gray-300 font-bold text-lg text-blue-900 bg-gray-50">
              {bancoNum}
            </div>
            <div className="px-4 py-3 border-r border-gray-300 font-bold text-blue-900 bg-gray-50">
              {bancoNome}
            </div>
            <div className="flex-1 px-4 py-3 font-mono text-xs text-gray-700 tracking-wider bg-gray-50">
              {linhaDigitavel}
            </div>
          </div>

          {/* ── Cedente ── */}
          <div className="grid grid-cols-2 border-b border-gray-300">
            <div className="p-4 border-r border-gray-300">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Beneficiário / Cedente
              </p>
              <p className="font-semibold text-gray-900">
                {cobranca.cliente}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Agência / Código do Beneficiário
              </p>
              <p className="font-semibold text-gray-900 tabular-nums">{agenciaConta}</p>
            </div>
          </div>

          {/* ── Linha de dados ── */}
          <div className="grid grid-cols-4 border-b border-gray-300">
            <div className="p-4 border-r border-gray-300">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Data do documento
              </p>
              <p className="font-medium text-gray-900 tabular-nums">
                {fmtDate(cobranca.dataEmissao)}
              </p>
            </div>
            <div className="p-4 border-r border-gray-300">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Nº do documento
              </p>
              <p className="font-medium text-gray-900 tabular-nums">
                {numDocumento}
              </p>
            </div>
            <div className="p-4 border-r border-gray-300">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Espécie moeda
              </p>
              <p className="font-medium text-gray-900">R$</p>
            </div>
            <div className="p-4 bg-gray-50">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Valor do documento
              </p>
              <p className="font-bold text-gray-900 text-lg tabular-nums">
                {fmt(cobranca.valorOriginal)}
              </p>
            </div>
          </div>

          {/* ── Vencimento ── */}
          <div className="grid grid-cols-2 border-b border-gray-300">
            <div className="p-4 border-r border-gray-300">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Data de vencimento
              </p>
              <p className="font-semibold text-gray-900 tabular-nums">
                {fmtDate(cobranca.dataVencimento)}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Nosso número
              </p>
              <p className="font-medium text-gray-900 tabular-nums">
                {nossoNumero}
              </p>
            </div>
          </div>

          {/* ── Sacado ── */}
          <div className="p-4 border-b border-gray-300">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
              Pagador / Sacado
            </p>
            <p className="font-semibold text-gray-900">
              {franqueado?.razaoSocial ?? cobranca.cliente}
            </p>
            <p className="text-xs text-gray-600">
              CNPJ: {franqueado?.cnpj ?? "—"}
            </p>
          </div>

          {/* ── Instruções ── */}
          <div className="p-4 border-b border-gray-300 bg-yellow-50/50">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
              Instruções (texto de responsabilidade do beneficiário)
            </p>
            <div className="space-y-1">
              {instrucoes.map((inst, i) => (
                <p key={i} className="text-xs text-gray-700 leading-relaxed">
                  {inst}
                </p>
              ))}
            </div>
          </div>

          {/* ── Código de barras fake ── */}
          <div className="p-6 flex flex-col items-center gap-3">
            <div
              className="w-full h-14 rounded"
              style={{
                background:
                  "repeating-linear-gradient(90deg, #1a1a1a 0px, #1a1a1a 2px, transparent 2px, transparent 4px, #1a1a1a 4px, #1a1a1a 5px, transparent 5px, transparent 8px, #1a1a1a 8px, #1a1a1a 11px, transparent 11px, transparent 13px, #1a1a1a 13px, #1a1a1a 14px, transparent 14px, transparent 18px)",
              }}
            />
            <p className="font-mono text-xs text-gray-500 tracking-widest select-all">
              {linhaDigitavel}
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => copy(linhaDigitavel)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar linha digitável
              </>
            )}
          </button>
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
