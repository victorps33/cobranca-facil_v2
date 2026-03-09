"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getFranqueadoraHeaders } from "@/lib/fetch-with-tenant";
import { useFranqueadora } from "@/components/providers/FranqueadoraProvider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/use-toast";
import { TEMPLATE_PRESETS } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  Mail,
  MessageSquare,
  MessageCircle,
  Phone,
  ShieldAlert,
  FileText,
  Scale,
  Info,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface DunningStep {
  id: string;
  trigger: string;
  offsetDays: number;
  channel: string;
  template: string;
  enabled: boolean;
  phase: string;
}

interface DunningRule {
  id: string;
  name: string;
  active: boolean;
  riskProfile: string;
  maxPhase: string;
  timezone: string;
  createdAt: string;
  steps: DunningStep[];
}

// ============================================
// PHASE METADATA
// ============================================

const PHASE_LABELS: Record<string, string> = {
  LEMBRETE: "Lembrete",
  VENCIMENTO: "Vencimento",
  ATRASO: "Atraso",
  NEGATIVACAO: "Negativacao",
  COBRANCA_INTENSIVA: "Cobranca Intensiva",
  PROTESTO: "Protesto",
  POS_PROTESTO: "Pos-Protesto",
};

const PHASE_COLORS: Record<string, string> = {
  LEMBRETE: "bg-gray-200",
  VENCIMENTO: "bg-red-500",
  ATRASO: "bg-orange-500",
  NEGATIVACAO: "bg-blue-800",
  COBRANCA_INTENSIVA: "bg-blue-500",
  PROTESTO: "bg-gray-900",
  POS_PROTESTO: "bg-gray-600",
};

const PHASE_ORDER = [
  "LEMBRETE",
  "VENCIMENTO",
  "ATRASO",
  "NEGATIVACAO",
  "COBRANCA_INTENSIVA",
  "PROTESTO",
  "POS_PROTESTO",
];

// ============================================
// CHANNEL METADATA
// ============================================

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  EMAIL: Mail,
  SMS: MessageSquare,
  WHATSAPP: MessageCircle,
  LIGACAO: Phone,
  BOA_VISTA: ShieldAlert,
  CARTORIO: FileText,
  JURIDICO: Scale,
};

const CHANNEL_META: Record<string, { label: string; icon: string }> = {
  EMAIL: { label: "Email", icon: "Mail" },
  SMS: { label: "SMS", icon: "MessageSquare" },
  WHATSAPP: { label: "WhatsApp", icon: "MessageCircle" },
  LIGACAO: { label: "Ligacao", icon: "Phone" },
  BOA_VISTA: { label: "Boa Vista", icon: "ShieldAlert" },
  CARTORIO: { label: "Cartorio", icon: "FileText" },
  JURIDICO: { label: "Juridico", icon: "Scale" },
};

const ESCALATION_CHANNELS = ["BOA_VISTA", "CARTORIO", "JURIDICO"];

// ============================================
// RISK PROFILE METADATA
// ============================================

const RISK_PROFILE_META: Record<string, { label: string; color: string }> = {
  BOM_PAGADOR: { label: "Bom Pagador", color: "bg-green-100 text-green-800" },
  DUVIDOSO: { label: "Duvidoso", color: "bg-yellow-100 text-yellow-800" },
  MAU_PAGADOR: { label: "Mau Pagador", color: "bg-red-100 text-red-800" },
};

// ============================================
// HELPERS
// ============================================

function triggerFromPhase(phase: string): string {
  if (phase === "LEMBRETE") return "BEFORE_DUE";
  if (phase === "VENCIMENTO") return "ON_DUE";
  return "AFTER_DUE";
}

function formatStepLabel(step: DunningStep): string {
  if (step.trigger === "BEFORE_DUE") return `D-${step.offsetDays}`;
  if (step.trigger === "ON_DUE") return "D0";
  if (step.trigger === "AFTER_DUE") return `D+${step.offsetDays}`;
  return "";
}

function phaseIndex(phase: string): number {
  return PHASE_ORDER.indexOf(phase);
}

function isPhaseEnabled(phase: string, maxPhase: string): boolean {
  return phaseIndex(phase) <= phaseIndex(maxPhase);
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function ReguaDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const { activeFranqueadoraId } = useFranqueadora();

  const [rule, setRule] = useState<DunningRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Accordion state
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Add step forms (per phase)
  const [addingStepPhase, setAddingStepPhase] = useState<string | null>(null);
  const [stepFormData, setStepFormData] = useState({
    offsetDays: "5",
    channel: "EMAIL",
    template: "",
  });
  const [formLoading, setFormLoading] = useState(false);

  // Inline edit step
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    offsetDays: "0",
    channel: "EMAIL",
    template: "",
  });

  // Confirm dialogs
  const [confirmDeleteRule, setConfirmDeleteRule] = useState(false);
  const [confirmDeleteStepId, setConfirmDeleteStepId] = useState<string | null>(null);

  // ── Headers ──
  const headers = useCallback(() => {
    return {
      "Content-Type": "application/json",
      ...getFranqueadoraHeaders(),
    };
  }, []);

  // ── Fetch rule ──
  const fetchRule = useCallback(async () => {
    try {
      const res = await fetch(`/api/dunning-rules/${params.id}`, {
        headers: getFranqueadoraHeaders(),
      });
      if (!res.ok) throw new Error("Rule not found");
      const data = await res.json();
      setRule(data);
    } catch {
      toast({
        title: "Erro",
        description: "Regua nao encontrada",
        variant: "destructive",
      });
      router.push("/reguas");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    fetchRule();
  }, [fetchRule, activeFranqueadoraId]);

  // ── Toggle accordion ──
  const togglePhase = (phase: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };

  // ── Update rule name ──
  const handleSaveName = async () => {
    if (!nameInput.trim() || nameInput.trim() === rule?.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/dunning-rules/${params.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update name");
      toast({ title: "Nome atualizado!" });
      fetchRule();
    } catch {
      toast({ title: "Erro", description: "Falha ao atualizar nome", variant: "destructive" });
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  };

  // ── Toggle rule active ──
  const toggleActive = async (active: boolean) => {
    try {
      const res = await fetch(`/api/dunning-rules/${params.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: active ? "Regua ativada!" : "Regua desativada!" });
      fetchRule();
    } catch {
      toast({ title: "Erro", description: "Falha ao atualizar regua", variant: "destructive" });
    }
  };

  // ── Update maxPhase ──
  const updateMaxPhase = async (maxPhase: string) => {
    try {
      const res = await fetch(`/api/dunning-rules/${params.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ maxPhase }),
      });
      if (!res.ok) throw new Error("Failed to update maxPhase");
      toast({ title: "Fase maxima atualizada!" });
      fetchRule();
    } catch {
      toast({ title: "Erro", description: "Falha ao atualizar fase maxima", variant: "destructive" });
    }
  };

  // ── Delete rule ──
  const handleDeleteRule = async () => {
    try {
      const res = await fetch(`/api/dunning-rules/${params.id}`, {
        method: "DELETE",
        headers: getFranqueadoraHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Regua excluida!", description: "A regua foi removida com sucesso." });
      router.push("/reguas");
    } catch {
      toast({ title: "Erro", description: "Falha ao excluir regua", variant: "destructive" });
    }
  };

  // ── Create step ──
  const handleCreateStep = async (phase: string) => {
    setFormLoading(true);
    const trigger = triggerFromPhase(phase);
    const offsetDays = phase === "VENCIMENTO" ? 0 : parseInt(stepFormData.offsetDays);
    const isEscalation = ESCALATION_CHANNELS.includes(stepFormData.channel);

    try {
      const res = await fetch("/api/dunning-steps", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          ruleId: params.id,
          trigger,
          offsetDays,
          channel: stepFormData.channel,
          template: isEscalation ? "" : stepFormData.template,
          phase,
        }),
      });
      if (!res.ok) throw new Error("Failed to create step");
      toast({ title: "Step criado!", description: "O step foi adicionado a regua." });
      setAddingStepPhase(null);
      resetStepForm();
      fetchRule();
    } catch {
      toast({ title: "Erro", description: "Falha ao criar step", variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  };

  // ── Update step ──
  const handleUpdateStep = async (stepId: string, phase: string) => {
    setFormLoading(true);
    const trigger = triggerFromPhase(phase);
    const offsetDays = phase === "VENCIMENTO" ? 0 : parseInt(editFormData.offsetDays);
    const isEscalation = ESCALATION_CHANNELS.includes(editFormData.channel);

    try {
      const res = await fetch(`/api/dunning-steps/${stepId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          trigger,
          offsetDays,
          channel: editFormData.channel,
          template: isEscalation ? "" : editFormData.template,
          phase,
        }),
      });
      if (!res.ok) throw new Error("Failed to update step");
      toast({ title: "Step atualizado!" });
      setEditingStepId(null);
      fetchRule();
    } catch {
      toast({ title: "Erro", description: "Falha ao atualizar step", variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete step ──
  const handleDeleteStep = async (stepId: string) => {
    try {
      const res = await fetch(`/api/dunning-steps/${stepId}`, {
        method: "DELETE",
        headers: getFranqueadoraHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete step");
      toast({ title: "Step excluido!" });
      fetchRule();
    } catch {
      toast({ title: "Erro", description: "Falha ao excluir step", variant: "destructive" });
    }
  };

  // ── Toggle step enabled ──
  const toggleStepEnabled = async (stepId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/dunning-steps/${stepId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to update step");
      fetchRule();
    } catch {
      toast({ title: "Erro", description: "Falha ao atualizar step", variant: "destructive" });
    }
  };

  // ── Form helpers ──
  const resetStepForm = () => {
    setStepFormData({ offsetDays: "5", channel: "EMAIL", template: "" });
  };

  const openAddStepForm = (phase: string) => {
    resetStepForm();
    setAddingStepPhase(phase);
    // Auto-expand phase if collapsed
    setExpandedPhases((prev) => new Set([...prev, phase]));
  };

  const openEditStep = (step: DunningStep) => {
    setEditingStepId(step.id);
    setEditFormData({
      offsetDays: step.offsetDays.toString(),
      channel: step.channel,
      template: step.template,
    });
  };

  const applyPreset = (presetId: string, isEdit: boolean) => {
    const preset = TEMPLATE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    if (isEdit) {
      setEditFormData({
        ...editFormData,
        channel: preset.channel,
        template: preset.template,
      });
    } else {
      setStepFormData({
        ...stepFormData,
        channel: preset.channel,
        template: preset.template,
      });
    }
  };

  // ── Group steps by phase ──
  const stepsByPhase = useCallback(
    (phase: string): DunningStep[] => {
      if (!rule) return [];
      return rule.steps
        .filter((s) => s.phase === phase)
        .sort((a, b) => {
          if (a.trigger === "BEFORE_DUE" && b.trigger === "BEFORE_DUE")
            return b.offsetDays - a.offsetDays;
          if (a.trigger === "BEFORE_DUE") return -1;
          if (b.trigger === "BEFORE_DUE") return 1;
          return a.offsetDays - b.offsetDays;
        });
    },
    [rule]
  );

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!rule) return null;

  const riskMeta = RISK_PROFILE_META[rule.riskProfile] || {
    label: rule.riskProfile,
    color: "bg-gray-100 text-gray-800",
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link href="/reguas" aria-label="Voltar para reguas">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>

        <div className="flex-1 min-w-0">
          {/* Rule name (editable) */}
          <div className="flex items-center gap-2">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="text-xl font-bold h-9 w-80"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSaveName}
                  disabled={savingName}
                >
                  {savingName ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingName(false)}
                >
                  <X className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold truncate">{rule.name}</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setNameInput(rule.name);
                    setEditingName(true);
                  }}
                  aria-label="Editar nome"
                >
                  <Pencil className="h-3.5 w-3.5 text-gray-400" />
                </Button>
              </div>
            )}
          </div>

          {/* Risk profile badge */}
          <div className="flex items-center gap-2 mt-1">
            <Badge className={riskMeta.color}>{riskMeta.label}</Badge>
            <span className="text-xs text-muted-foreground">
              Timezone: {rule.timezone}
            </span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Max phase dropdown */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              Ate qual fase esta regua vai:
            </Label>
            <Select value={rule.maxPhase} onValueChange={updateMaxPhase}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHASE_ORDER.map((phase) => (
                  <SelectItem key={phase} value={phase}>
                    {PHASE_LABELS[phase]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <Label className="text-sm">Ativa</Label>
            <Switch
              checked={rule.active}
              onCheckedChange={toggleActive}
            />
          </div>

          {/* Delete rule */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setConfirmDeleteRule(true)}
            aria-label="Excluir regua"
          >
            <Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* ── Phase Accordion ── */}
      <div className="space-y-3">
        {PHASE_ORDER.map((phase) => {
          const enabled = isPhaseEnabled(phase, rule.maxPhase);
          const steps = stepsByPhase(phase);
          const expanded = expandedPhases.has(phase);

          return (
            <PhaseSection
              key={phase}
              phase={phase}
              enabled={enabled}
              expanded={expanded}
              stepCount={steps.length}
              onToggleExpand={() => togglePhase(phase)}
              maxPhase={rule.maxPhase}
            >
              {expanded && enabled && (
                <div className="px-4 pb-4 space-y-2">
                  {/* Step cards */}
                  {steps.length === 0 && (
                    <p className="text-sm text-muted-foreground py-3 text-center">
                      Nenhum step nesta fase.
                    </p>
                  )}
                  {steps.map((step) => (
                    <div key={step.id}>
                      {editingStepId === step.id ? (
                        <StepEditForm
                          step={step}
                          phase={phase}
                          editFormData={editFormData}
                          setEditFormData={setEditFormData}
                          formLoading={formLoading}
                          onSave={() => handleUpdateStep(step.id, phase)}
                          onCancel={() => setEditingStepId(null)}
                          onApplyPreset={(id) => applyPreset(id, true)}
                        />
                      ) : (
                        <StepCard
                          step={step}
                          onToggleEnabled={(enabled) =>
                            toggleStepEnabled(step.id, enabled)
                          }
                          onEdit={() => openEditStep(step)}
                          onDelete={() => setConfirmDeleteStepId(step.id)}
                        />
                      )}
                    </div>
                  ))}

                  {/* Add step form or button */}
                  {addingStepPhase === phase ? (
                    <AddStepForm
                      phase={phase}
                      stepFormData={stepFormData}
                      setStepFormData={setStepFormData}
                      formLoading={formLoading}
                      onSave={() => handleCreateStep(phase)}
                      onCancel={() => {
                        setAddingStepPhase(null);
                        resetStepForm();
                      }}
                      onApplyPreset={(id) => applyPreset(id, false)}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full border border-dashed border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400"
                      onClick={() => openAddStepForm(phase)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar step
                    </Button>
                  )}
                </div>
              )}
            </PhaseSection>
          );
        })}
      </div>

      {/* ── Confirm dialogs ── */}
      <ConfirmDialog
        open={confirmDeleteRule}
        onOpenChange={setConfirmDeleteRule}
        title="Excluir regua?"
        description="Esta acao nao pode ser desfeita. Todos os steps serao excluidos."
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleDeleteRule}
      />
      <ConfirmDialog
        open={!!confirmDeleteStepId}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteStepId(null);
        }}
        title="Excluir step?"
        description="Esta acao nao pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteStepId) handleDeleteStep(confirmDeleteStepId);
        }}
      />
    </div>
  );
}

// ============================================
// PHASE SECTION (Accordion)
// ============================================

function PhaseSection({
  phase,
  enabled,
  expanded,
  stepCount,
  onToggleExpand,
  maxPhase,
  children,
}: {
  phase: string;
  enabled: boolean;
  expanded: boolean;
  stepCount: number;
  onToggleExpand: () => void;
  maxPhase: string;
  children?: React.ReactNode;
}) {
  const colorBar = PHASE_COLORS[phase] || "bg-gray-200";
  const label = PHASE_LABELS[phase] || phase;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white overflow-hidden transition-opacity",
        enabled ? "border-gray-200" : "border-gray-100 opacity-50"
      )}
    >
      {/* Phase header */}
      <button
        onClick={enabled ? onToggleExpand : undefined}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
          enabled
            ? "hover:bg-gray-50 cursor-pointer"
            : "cursor-default"
        )}
        aria-expanded={expanded}
      >
        {/* Color bar */}
        <div className={cn("w-1.5 h-8 rounded-full shrink-0", colorBar)} />

        {/* Phase label and step count */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900">
              {label}
            </span>
            <span className="text-xs text-muted-foreground">
              {stepCount} {stepCount === 1 ? "step" : "steps"}
            </span>
          </div>
        </div>

        {/* Disabled hint */}
        {!enabled && (
          <span className="text-xs text-muted-foreground italic">
            Ativar fase (mude a fase maxima para{" "}
            {PHASE_LABELS[phase] || phase})
          </span>
        )}

        {/* Chevron */}
        {enabled &&
          (expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
          ))}
      </button>

      {/* Content (steps) */}
      {children}
    </div>
  );
}

// ============================================
// STEP CARD
// ============================================

function StepCard({
  step,
  onToggleEnabled,
  onEdit,
  onDelete,
}: {
  step: DunningStep;
  onToggleEnabled: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ChannelIcon = CHANNEL_ICONS[step.channel] || Mail;
  const channelLabel = CHANNEL_META[step.channel]?.label || step.channel;
  const isEscalation = ESCALATION_CHANNELS.includes(step.channel);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        step.enabled
          ? "bg-white border-gray-200"
          : "bg-gray-50 border-gray-100 opacity-60"
      )}
    >
      {/* Day offset */}
      <span className="font-mono font-bold text-sm w-12 shrink-0 text-center">
        {formatStepLabel(step)}
      </span>

      {/* Channel icon + label */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ChannelIcon className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <span className="text-sm font-medium text-gray-700">
          {channelLabel}
        </span>
      </div>

      {/* Template preview */}
      <div className="flex-1 min-w-0">
        {isEscalation ? (
          <span className="text-xs text-amber-600 italic">
            Tarefa de aprovacao
          </span>
        ) : (
          <span className="text-xs text-gray-500 truncate block">
            {step.template
              ? step.template.substring(0, 80) + (step.template.length > 80 ? "..." : "")
              : "Sem template"}
          </span>
        )}
      </div>

      {/* Toggle enabled */}
      <Switch
        checked={step.enabled}
        onCheckedChange={onToggleEnabled}
        className="shrink-0"
      />

      {/* Edit */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        aria-label="Editar step"
        className="shrink-0"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="Excluir step"
        className="shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
      </Button>
    </div>
  );
}

// ============================================
// STEP FORM FIELDS (shared between add/edit)
// ============================================

function StepFormFields({
  phase,
  formData,
  setFormData,
  onApplyPreset,
}: {
  phase: string;
  formData: { offsetDays: string; channel: string; template: string };
  setFormData: (data: { offsetDays: string; channel: string; template: string }) => void;
  onApplyPreset: (presetId: string) => void;
}) {
  const isVencimento = phase === "VENCIMENTO";
  const isEscalation = ESCALATION_CHANNELS.includes(formData.channel);

  return (
    <div className="space-y-3">
      {/* Preset dropdown */}
      <div className="space-y-1">
        <Label className="text-xs">Modelo pronto</Label>
        <Select onValueChange={onApplyPreset}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecione um modelo" />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Offset days */}
        <div className="space-y-1">
          <Label className="text-xs">Dias (offset)</Label>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={isVencimento ? "0" : formData.offsetDays}
            onChange={(e) =>
              setFormData({ ...formData, offsetDays: e.target.value })
            }
            disabled={isVencimento}
            className="h-8 text-sm"
          />
          {isVencimento && (
            <p className="text-[10px] text-muted-foreground">
              Fixo em D0 (vencimento)
            </p>
          )}
        </div>

        {/* Channel */}
        <div className="space-y-1">
          <Label className="text-xs">Canal</Label>
          <Select
            value={formData.channel}
            onValueChange={(value) =>
              setFormData({ ...formData, channel: value })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CHANNEL_META).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Escalation info alert */}
      {isEscalation && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Esta acao gerara uma tarefa de aprovacao para o administrador
          </p>
        </div>
      )}

      {/* Template */}
      <div className="space-y-1">
        <Label className="text-xs">Template da mensagem</Label>
        <Textarea
          value={formData.template}
          onChange={(e) =>
            setFormData({ ...formData, template: e.target.value })
          }
          placeholder="Use variaveis: {{nome}}, {{valor}}, {{vencimento}}, {{link_boleto}}, {{descricao}}"
          rows={4}
          disabled={isEscalation}
          className="text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Variaveis: {"{{nome}}"}, {"{{valor}}"}, {"{{vencimento}}"},{"  "}
          {"{{link_boleto}}"}, {"{{descricao}}"}
        </p>
      </div>
    </div>
  );
}

// ============================================
// ADD STEP FORM
// ============================================

function AddStepForm({
  phase,
  stepFormData,
  setStepFormData,
  formLoading,
  onSave,
  onCancel,
  onApplyPreset,
}: {
  phase: string;
  stepFormData: { offsetDays: string; channel: string; template: string };
  setStepFormData: (data: { offsetDays: string; channel: string; template: string }) => void;
  formLoading: boolean;
  onSave: () => void;
  onCancel: () => void;
  onApplyPreset: (id: string) => void;
}) {
  const isEscalation = ESCALATION_CHANNELS.includes(stepFormData.channel);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">Novo Step</h4>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <StepFormFields
        phase={phase}
        formData={stepFormData}
        setFormData={setStepFormData}
        onApplyPreset={onApplyPreset}
      />

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={formLoading || (!isEscalation && !stepFormData.template.trim())}
        >
          {formLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}

// ============================================
// STEP EDIT FORM (INLINE)
// ============================================

function StepEditForm({
  step,
  phase,
  editFormData,
  setEditFormData,
  formLoading,
  onSave,
  onCancel,
  onApplyPreset,
}: {
  step: DunningStep;
  phase: string;
  editFormData: { offsetDays: string; channel: string; template: string };
  setEditFormData: (data: { offsetDays: string; channel: string; template: string }) => void;
  formLoading: boolean;
  onSave: () => void;
  onCancel: () => void;
  onApplyPreset: (id: string) => void;
}) {
  const isEscalation = ESCALATION_CHANNELS.includes(editFormData.channel);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">
          Editar Step ({formatStepLabel(step)})
        </h4>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <StepFormFields
        phase={phase}
        formData={editFormData}
        setFormData={setEditFormData}
        onApplyPreset={onApplyPreset}
      />

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={formLoading || (!isEscalation && !editFormData.template.trim())}
        >
          {formLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
