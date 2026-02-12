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
import { INTERACTION_TYPE_LABELS } from "@/lib/crm-constants";
import type { CrmInteraction } from "@/lib/types/crm";

interface AddInteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  onSave: (interaction: Omit<CrmInteraction, "id" | "customerId" | "customerName" | "createdBy" | "createdById" | "createdAt">) => void;
}

const typeOptions = Object.entries(INTERACTION_TYPE_LABELS) as [CrmInteraction["type"], string][];

export function AddInteractionDialog({
  open,
  onOpenChange,
  customerName,
  onSave,
}: AddInteractionDialogProps) {
  const [type, setType] = useState<CrmInteraction["type"]>("TELEFONE");
  const [direction, setDirection] = useState<CrmInteraction["direction"]>("OUTBOUND");
  const [content, setContent] = useState("");

  const handleSave = () => {
    if (!content.trim()) return;
    onSave({ type, direction, content: content.trim() });
    setType("TELEFONE");
    setDirection("OUTBOUND");
    setContent("");
    onOpenChange(false);
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      setType("TELEFONE");
      setDirection("OUTBOUND");
      setContent("");
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Interação</DialogTitle>
          <DialogDescription>
            Nova interação com {customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CrmInteraction["type"])}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
            >
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Direção</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as CrmInteraction["direction"])}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
            >
              <option value="OUTBOUND">Enviado</option>
              <option value="INBOUND">Recebido</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Conteúdo</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Descreva a interação..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => handleClose(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
