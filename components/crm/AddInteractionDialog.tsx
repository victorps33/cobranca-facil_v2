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
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
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
          <FormField label="Tipo">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CrmInteraction["type"])}
              className="w-full h-11 px-4 py-2 text-sm border border-gray-200 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-secondary/30 focus-visible:border-secondary focus-visible:outline-none"
            >
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Direção">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as CrmInteraction["direction"])}
              className="w-full h-11 px-4 py-2 text-sm border border-gray-200 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-secondary/30 focus-visible:border-secondary focus-visible:outline-none"
            >
              <option value="OUTBOUND">Enviado</option>
              <option value="INBOUND">Recebido</option>
            </select>
          </FormField>

          <FormField label="Conteúdo">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Descreva a interação..."
              rows={4}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-secondary/30 focus-visible:border-secondary focus-visible:outline-none resize-none"
            />
          </FormField>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!content.trim()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
