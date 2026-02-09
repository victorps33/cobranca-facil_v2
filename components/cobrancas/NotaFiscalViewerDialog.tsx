"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Printer } from "lucide-react";
import type { Cobranca } from "@/lib/data/cobrancas-dummy";
import type { Franqueado } from "@/lib/data/clientes-dummy";
import type { ApuracaoDetalhe } from "@/lib/data/apuracao-historico-dummy";
import { getNfByCobranca, type NotaFiscal } from "@/lib/data/documentos-dummy";
import { FRANQUEADORA, fmt, fmtDate } from "@/lib/constants";

interface NotaFiscalViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobranca: Cobranca | null;
  franqueado?: Franqueado | null;
  detalhe?: ApuracaoDetalhe | null;
}

export function NotaFiscalViewerDialog({
  open,
  onOpenChange,
  cobranca,
  franqueado,
  detalhe,
}: NotaFiscalViewerDialogProps) {
  if (!cobranca) return null;

  // Use centralized dummy data, fallback to inline generation
  const nf = getNfByCobranca(cobranca.id);

  const nfNumero = nf?.numero ?? cobranca.id.slice(0, 8).toUpperCase();
  const nfSerie = nf?.serie ?? "RPS";
  const hashVerificacao = nf?.codigoVerificacao ?? cobranca.id.replace(/-/g, "").toUpperCase().slice(0, 32);
  const valorServicos = nf?.valorServicos ?? cobranca.valorOriginal;

  const iss = nf?.valorIss ?? Math.round(valorServicos * 0.05);
  const pis = nf?.valorPis ?? Math.round(valorServicos * 0.0065);
  const cofins = nf?.valorCofins ?? Math.round(valorServicos * 0.03);
  const inss = nf?.valorInss ?? 0;
  const ir = nf?.valorIr ?? Math.round(valorServicos * 0.015);
  const csll = nf?.valorCsll ?? Math.round(valorServicos * 0.01);
  const valorLiquido = nf?.valorLiquido ?? (valorServicos - iss);

  const discriminacao = nf?.discriminacao ?? cobranca.descricao;
  const codigoServico = nf?.codigoServico ?? "17.08";
  const cnae = nf?.cnaeAtividade ?? "7020-4/00";
  const naturezaOp = nf?.naturezaOperacao ?? "Tributação no Município";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Nota Fiscal de Serviços Eletrônica</DialogTitle>
          <DialogDescription>
            NFS-e da cobrança #{cobranca.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-0 border border-gray-300 rounded-lg overflow-hidden text-sm">
          {/* ── Header NFS-e ── */}
          <div className="bg-blue-900 text-white px-6 py-4 text-center space-y-1">
            <p className="text-xs uppercase tracking-widest opacity-80">
              Prefeitura do Município de São Paulo
            </p>
            <h2 className="text-base font-bold uppercase tracking-wide">
              Nota Fiscal de Serviços Eletrônica — NFS-e
            </h2>
            <div className="flex items-center justify-center gap-6 text-xs opacity-90 mt-2">
              <span>
                Nº <strong>{nfNumero}</strong>
              </span>
              <span>Série: <strong>{nfSerie}</strong></span>
              <span>
                Data de emissão:{" "}
                <strong>{fmtDate(cobranca.dataEmissao)}</strong>
              </span>
            </div>
          </div>

          {/* ── Natureza da operação ── */}
          <div className="px-5 py-3 border-b border-gray-300 bg-gray-50 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Natureza da operação</p>
              <p className="text-xs font-medium text-gray-700">{naturezaOp}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Código do serviço</p>
              <p className="text-xs font-medium text-gray-700">{codigoServico}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">CNAE</p>
              <p className="text-xs font-medium text-gray-700">{cnae}</p>
            </div>
          </div>

          {/* ── Emitente ── */}
          <div className="p-5 border-b border-gray-300">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
              Prestador de Serviços (Emitente)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="font-semibold text-gray-900">
                  {nf?.prestador.razaoSocial ?? FRANQUEADORA.razaoSocial}
                </p>
                <p className="text-xs text-gray-600">
                  CNPJ: {nf?.prestador.cnpj ?? FRANQUEADORA.cnpj}
                </p>
                <p className="text-xs text-gray-600">
                  Inscrição Municipal: {nf?.prestador.inscricaoMunicipal ?? FRANQUEADORA.inscricaoMunicipal}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-600">{nf?.prestador.endereco ?? FRANQUEADORA.endereco}</p>
              </div>
            </div>
          </div>

          {/* ── Destinatário ── */}
          <div className="p-5 border-b border-gray-300">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
              Tomador de Serviços (Destinatário)
            </p>
            <div className="space-y-1">
              <p className="font-semibold text-gray-900">
                {nf?.tomador.razaoSocial ?? franqueado?.razaoSocial ?? cobranca.cliente}
              </p>
              <p className="text-xs text-gray-600">
                CNPJ: {nf?.tomador.cnpj ?? franqueado?.cnpj ?? "—"}
              </p>
              <p className="text-xs text-gray-600">
                {nf?.tomador.endereco ?? (franqueado ? `${franqueado.bairro}, ${franqueado.cidade}/${franqueado.estado}` : "")}
              </p>
            </div>
          </div>

          {/* ── Discriminação dos serviços ── */}
          <div className="p-5 border-b border-gray-300">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
              Discriminação dos Serviços
            </p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-xs text-gray-700 leading-relaxed">
              <p>{discriminacao}</p>
              <p>
                <strong>Competência:</strong> {cobranca.competencia}
              </p>
              {detalhe && (
                <>
                  <div className="border-t border-gray-200 pt-2 mt-2" />
                  <p>
                    <strong>Faturamento apurado:</strong>{" "}
                    {fmt(detalhe.faturamento)}
                  </p>
                  <p>
                    <strong>Royalties (5%):</strong> {fmt(detalhe.royalties)}
                  </p>
                  <p>
                    <strong>Taxa de Marketing (2%):</strong>{" "}
                    {fmt(detalhe.marketing)}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ── Valores e Tributos ── */}
          <div className="p-5 border-b border-gray-300">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-3">
              Valores e Tributos
            </p>
            <div className="grid grid-cols-3 gap-4">
              <TributoCell
                label="Valor dos Serviços"
                value={fmt(valorServicos)}
                highlight
              />
              <TributoCell label="ISS (5%)" value={fmt(iss)} />
              <TributoCell label="PIS (0,65%)" value={fmt(pis)} />
              <TributoCell label="COFINS (3%)" value={fmt(cofins)} />
              <TributoCell label="INSS" value={fmt(inss)} />
              <TributoCell label="IR (1,5%)" value={fmt(ir)} />
              <TributoCell label="CSLL (1%)" value={fmt(csll)} />
              <TributoCell
                label="Valor Líquido da NF"
                value={fmt(valorLiquido)}
                highlight
              />
            </div>
          </div>

          {/* ── Código de verificação ── */}
          <div className="p-5 bg-gray-50">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
              Código de Verificação da Autenticidade
            </p>
            <p className="font-mono text-xs text-gray-600 tracking-widest">
              {hashVerificacao}
            </p>
            <p className="text-[10px] text-gray-400 mt-2">
              Documento emitido por sistema informatizado. Sua autenticidade pode
              ser verificada no portal da prefeitura.
            </p>
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

function TributoCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p
        className={`text-sm tabular-nums ${highlight ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}
      >
        {value}
      </p>
    </div>
  );
}
