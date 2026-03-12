"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFranqueadoraHeaders } from "@/lib/fetch-with-tenant";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Sparkles, Trash2 } from "lucide-react";

interface StepData {
  id: string;
  timingMode: string;
  channelMode: string;
  contentMode: string;
  fallbackTime: string | null;
  channel: string;
  allowedChannels: string[];
  optimizeFor: string;
  resolverStats?: {
    bestHourStart?: string | null;
    bestChannel?: string | null;
    timingConfidence?: number;
    channelConfidence?: number;
  } | null;
  variants?: VariantData[];
}

interface VariantData {
  id: string;
  label: string;
  template: string;
  active: boolean;
  sends: number;
  conversionRate: number;
  isWinner: boolean;
  generatedByAi: boolean;
}

interface StepEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: StepData;
  onSaved: () => void;
}

const CHANNEL_OPTIONS = [
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

const OPTIMIZE_OPTIONS = [
  { value: "PAYMENT", label: "Pagamento" },
  { value: "RESPONSE", label: "Resposta" },
  { value: "OPEN", label: "Abertura" },
];

export function StepEditorModal({
  open,
  onOpenChange,
  step,
  onSaved,
}: StepEditorModalProps) {
  const [timingMode, setTimingMode] = useState(step.timingMode);
  const [channelMode, setChannelMode] = useState(step.channelMode);
  const [contentMode, setContentMode] = useState(step.contentMode);
  const [fallbackTime, setFallbackTime] = useState(step.fallbackTime || "10:00");
  const [allowedChannels, setAllowedChannels] = useState<string[]>(
    step.allowedChannels || []
  );
  const [optimizeFor, setOptimizeFor] = useState(step.optimizeFor || "PAYMENT");
  const [variants, setVariants] = useState<VariantData[]>(step.variants || []);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    ...getFranqueadoraHeaders(),
  };

  const toggleAllowedChannel = (ch: string) => {
    setAllowedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/dunning-steps/${step.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          timingMode,
          channelMode,
          contentMode,
          fallbackTime,
          allowedChannels,
          optimizeFor,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Configuracao salva!" });
      onSaved();
      onOpenChange(false);
    } catch {
      toast({
        title: "Erro",
        description: "Falha ao salvar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateVariants = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/step-variants/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ stepId: step.id, count: 3 }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const created = await res.json();
      setVariants((prev) => [...prev, ...created]);
      toast({ title: `${created.length} variantes geradas!` });
    } catch {
      toast({
        title: "Erro",
        description: "Falha ao gerar variantes",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      const res = await fetch(`/api/step-variants?id=${variantId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Failed to delete");
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
    } catch {
      toast({
        title: "Erro",
        description: "Falha ao excluir variante",
        variant: "destructive",
      });
    }
  };

  const stats = step.resolverStats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Inteligencia</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Timing */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Horario</Label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">Manual</span>
                <Switch
                  checked={timingMode === "SMART"}
                  onCheckedChange={(checked) =>
                    setTimingMode(checked ? "SMART" : "MANUAL")
                  }
                />
                <span className="text-[10px] text-purple-600 font-medium">
                  Inteligente
                </span>
              </div>
            </div>
            {timingMode === "MANUAL" ? (
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">
                  Horario de envio
                </Label>
                <Input
                  type="time"
                  value={fallbackTime}
                  onChange={(e) => setFallbackTime(e.target.value)}
                  className="h-8 w-32 text-sm"
                />
              </div>
            ) : (
              <div className="rounded-lg bg-purple-50 border border-purple-100 p-3">
                <p className="text-xs text-purple-700">
                  O sistema encontrara o melhor horario para cada cliente.
                </p>
                {stats?.bestHourStart && (
                  <p className="text-xs text-purple-500 mt-1">
                    Melhor horario descoberto:{" "}
                    <span className="font-semibold">{stats.bestHourStart}</span>
                    {stats.timingConfidence != null && (
                      <span className="ml-1 text-gray-400">
                        ({Math.round(stats.timingConfidence * 100)}% confianca)
                      </span>
                    )}
                  </p>
                )}
                <div className="mt-2 space-y-1">
                  <Label className="text-[10px] text-purple-400">
                    Horario fallback (sem dados)
                  </Label>
                  <Input
                    type="time"
                    value={fallbackTime}
                    onChange={(e) => setFallbackTime(e.target.value)}
                    className="h-7 w-28 text-xs"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Channel */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Canal</Label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">Manual</span>
                <Switch
                  checked={channelMode === "SMART"}
                  onCheckedChange={(checked) =>
                    setChannelMode(checked ? "SMART" : "MANUAL")
                  }
                />
                <span className="text-[10px] text-purple-600 font-medium">
                  Inteligente
                </span>
              </div>
            </div>
            {channelMode === "MANUAL" ? (
              <p className="text-xs text-gray-500">
                Canal fixo: <span className="font-medium">{step.channel}</span>
              </p>
            ) : (
              <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 space-y-2">
                <p className="text-xs text-purple-700">
                  O sistema escolhera o melhor canal para cada cliente.
                </p>
                <Label className="text-[10px] text-purple-400">
                  Canais permitidos
                </Label>
                <div className="flex gap-2">
                  {CHANNEL_OPTIONS.map((ch) => (
                    <button
                      key={ch.value}
                      type="button"
                      onClick={() => toggleAllowedChannel(ch.value)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        allowedChannels.includes(ch.value)
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
                {stats?.bestChannel && (
                  <p className="text-xs text-purple-500 mt-1">
                    Melhor canal descoberto:{" "}
                    <span className="font-semibold">{stats.bestChannel}</span>
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Content */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Conteudo</Label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">Manual</span>
                <Switch
                  checked={contentMode === "SMART"}
                  onCheckedChange={(checked) =>
                    setContentMode(checked ? "SMART" : "MANUAL")
                  }
                />
                <span className="text-[10px] text-purple-600 font-medium">
                  Inteligente
                </span>
              </div>
            </div>
            {contentMode === "MANUAL" ? (
              <p className="text-xs text-gray-500">
                Usa o template fixo do step.
              </p>
            ) : (
              <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 space-y-3">
                <p className="text-xs text-purple-700">
                  O sistema testa variantes e otimiza automaticamente.
                </p>

                <div className="space-y-1">
                  <Label className="text-[10px] text-purple-400">
                    Otimizar para
                  </Label>
                  <Select value={optimizeFor} onValueChange={setOptimizeFor}>
                    <SelectTrigger className="h-7 text-xs w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPTIMIZE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Variants list */}
                {variants.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-[10px] text-purple-400">
                      Variantes ({variants.length})
                    </Label>
                    {variants.map((v) => (
                      <div
                        key={v.id}
                        className={`flex items-start gap-2 p-2 rounded-md border text-xs ${
                          v.isWinner
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <span className="font-bold text-gray-600 shrink-0">
                          {v.label}
                        </span>
                        <span className="flex-1 text-gray-500 line-clamp-2">
                          {v.template}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {v.sends > 0 && (
                            <span className="text-[10px] text-gray-400">
                              {v.sends} envios ·{" "}
                              {Math.round(v.conversionRate * 100)}%
                            </span>
                          )}
                          {v.isWinner && (
                            <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                              WINNER
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDeleteVariant(v.id)}
                          >
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateVariants}
                  disabled={generating}
                  className="w-full border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3 w-3" />
                  )}
                  Gerar variantes com Mia
                </Button>
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
