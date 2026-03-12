"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface ContaAzulConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContaAzulConfigDialog({
  open,
  onOpenChange,
}: ContaAzulConfigDialogProps) {
  const handleConnect = () => {
    window.location.href = "/api/integrations/conta-azul/authorize";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar Conta Azul</DialogTitle>
          <DialogDescription>
            Conecte sua conta do Conta Azul para sincronizar clientes, cobranças e notas fiscais automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-blue-50 rounded-xl p-4 space-y-2">
            <p className="text-sm text-blue-900 font-medium">Como funciona?</p>
            <ul className="text-sm text-blue-800 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">1.</span>
                Você será redirecionado para o Conta Azul
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">2.</span>
                Autorize o acesso à sua conta
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">3.</span>
                Pronto! A sincronização começa automaticamente
              </li>
            </ul>
          </div>

          <p className="text-xs text-gray-500">
            A conexão usa OAuth2 — suas credenciais ficam protegidas no Conta Azul. Você pode desconectar a qualquer momento.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <Button onClick={handleConnect}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Conectar com Conta Azul
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
