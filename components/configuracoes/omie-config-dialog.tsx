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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { fetchWithTenant } from "@/lib/fetch-with-tenant";

interface OmieConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function OmieConfigDialog({
  open,
  onOpenChange,
  onSaved,
}: OmieConfigDialogProps) {
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!appKey.trim() || !appSecret.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha App Key e App Secret.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithTenant("/api/erp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "OMIE",
          omieAppKey: appKey.trim(),
          omieAppSecret: appSecret.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar");
      }

      toast({
        title: "Omie configurado",
        description: "Credenciais salvas com sucesso.",
      });
      setAppKey("");
      setAppSecret("");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Falha ao salvar configuração.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      setAppKey("");
      setAppSecret("");
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Omie</DialogTitle>
          <DialogDescription>
            Insira as credenciais da API do Omie para sua franqueadora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="omie-app-key">App Key</Label>
            <Input
              id="omie-app-key"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              placeholder="Sua App Key do Omie"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="omie-app-secret">App Secret</Label>
            <Input
              id="omie-app-secret"
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="Sua App Secret do Omie"
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
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
