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
import type { Cobranca } from "@/lib/data/cobrancas-dummy";

interface EmitirNfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobranca: Cobranca | null;
  onEmitir: (cobrancaId: string, comBoleto: boolean) => void;
}

export function EmitirNfDialog({
  open,
  onOpenChange,
  cobranca,
  onEmitir,
}: EmitirNfDialogProps) {
  const [comBoleto, setComBoleto] = useState(false);

  if (!cobranca) return null;

  const handleConfirm = () => {
    onEmitir(cobranca.id, comBoleto);
    setComBoleto(false);
    onOpenChange(false);
  };

  const handleClose = (value: boolean) => {
    if (!value) setComBoleto(false);
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Emitir Nota Fiscal</DialogTitle>
          <DialogDescription>
            Confirme a emissão da NF para esta cobrança
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumo da cobrança */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Cliente</span>
              <span className="text-sm font-medium text-gray-900">{cobranca.cliente}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Descrição</span>
              <span className="text-sm text-gray-700 text-right max-w-[200px] truncate">{cobranca.descricao}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Valor</span>
              <span className="text-sm font-medium text-gray-900 tabular-nums">
                R$ {(cobranca.valorOriginal / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Categoria</span>
              <span className="text-sm text-gray-700">{cobranca.categoria}</span>
            </div>
          </div>

          {/* Toggle boleto */}
          <label className="flex items-center gap-3 cursor-pointer py-2">
            <input
              type="checkbox"
              checked={comBoleto}
              onChange={(e) => setComBoleto(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Gerar boleto junto com a NF</span>
              <p className="text-xs text-gray-400">Um boleto avulso será gerado vinculado a esta NF</p>
            </div>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => handleClose(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors"
          >
            Emitir NF
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
