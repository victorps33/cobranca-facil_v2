"use client";

import { useState, useEffect, useCallback } from "react";
import { getFranqueadoraHeaders } from "@/lib/fetch-with-tenant";
import { useFranqueadora } from "@/components/providers/FranqueadoraProvider";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Phone,
  ShieldAlert,
  FileText,
  Scale,
  Pencil,
} from "lucide-react";

/* ── Types ── */

interface ApiDunningStep {
  id: string;
  trigger: "BEFORE_DUE" | "ON_DUE" | "AFTER_DUE";
  offsetDays: number;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "LIGACAO" | "BOA_VISTA" | "CARTORIO" | "JURIDICO";
  phase: string;
  template: string;
  enabled: boolean;
}

interface ApiDunningRule {
  id: string;
  name: string;
  active: boolean;
  riskProfile: RiskProfileKey;
  maxPhase: string;
  createdAt: string;
  steps: ApiDunningStep[];
}

interface RiskScoreEntry {
  id: string;
  riskProfile: RiskProfileKey;
  customerId: string;
}

type RiskProfileKey = "BOM_PAGADOR" | "DUVIDOSO" | "MAU_PAGADOR";

/* ── Config ── */

const RISK_PROFILES: { key: RiskProfileKey; label: string; accent: string; activeBg: string; activeBorder: string; badge: string }[] = [
  {
    key: "BOM_PAGADOR",
    label: "Bom Pagador",
    accent: "text-emerald-700",
    activeBg: "bg-emerald-50",
    activeBorder: "border-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "DUVIDOSO",
    label: "Duvidoso",
    accent: "text-yellow-700",
    activeBg: "bg-yellow-50",
    activeBorder: "border-yellow-500",
    badge: "bg-yellow-100 text-yellow-700",
  },
  {
    key: "MAU_PAGADOR",
    label: "Mau Pagador",
    accent: "text-red-700",
    activeBg: "bg-red-50",
    activeBorder: "border-red-500",
    badge: "bg-red-100 text-red-700",
  },
];

const PHASE_ORDER = [
  "LEMBRETE",
  "VENCIMENTO",
  "ATRASO",
  "NEGATIVACAO",
  "COBRANCA_INTENSIVA",
  "PROTESTO",
  "POS_PROTESTO",
] as const;

const PHASE_LABELS: Record<string, string> = {
  LEMBRETE: "Lembrete",
  VENCIMENTO: "Vencimento",
  ATRASO: "Atraso",
  NEGATIVACAO: "Negativação",
  COBRANCA_INTENSIVA: "Cobrança Intensiva",
  PROTESTO: "Protesto",
  POS_PROTESTO: "Pós-Protesto",
};

const PHASE_COLORS: Record<string, { bg: string; text: string }> = {
  LEMBRETE: { bg: "bg-gray-200", text: "text-gray-700" },
  VENCIMENTO: { bg: "bg-red-500", text: "text-white" },
  ATRASO: { bg: "bg-orange-500", text: "text-white" },
  NEGATIVACAO: { bg: "bg-blue-800", text: "text-white" },
  COBRANCA_INTENSIVA: { bg: "bg-blue-500", text: "text-white" },
  PROTESTO: { bg: "bg-gray-900", text: "text-white" },
  POS_PROTESTO: { bg: "bg-gray-600", text: "text-white" },
};

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  EMAIL: Mail,
  SMS: MessageSquare,
  WHATSAPP: MessageCircle,
  LIGACAO: Phone,
  BOA_VISTA: ShieldAlert,
  CARTORIO: FileText,
  JURIDICO: Scale,
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  LIGACAO: "Ligação",
  BOA_VISTA: "Boa Vista",
  CARTORIO: "Cartório",
  JURIDICO: "Jurídico",
};

const ESCALATION_CHANNELS = new Set(["BOA_VISTA", "CARTORIO", "JURIDICO"]);

/* ── Helpers ── */

function formatOffset(trigger: string, offsetDays: number): string {
  if (trigger === "ON_DUE" || offsetDays === 0) return "D0";
  if (trigger === "BEFORE_DUE") return `D-${offsetDays}`;
  return `D+${offsetDays}`;
}

function isPhaseActive(phase: string, maxPhase: string): boolean {
  const phaseIdx = PHASE_ORDER.indexOf(phase as typeof PHASE_ORDER[number]);
  const maxIdx = PHASE_ORDER.indexOf(maxPhase as typeof PHASE_ORDER[number]);
  if (phaseIdx === -1 || maxIdx === -1) return false;
  return phaseIdx <= maxIdx;
}

/* ── Keyframes ── */

const KEYFRAMES = `
@keyframes regua-card-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes regua-node-in {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes regua-track-in {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes regua-pill-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

/* ── Page ── */

export default function ReguasPage() {
  const { activeFranqueadoraId } = useFranqueadora();
  const [activeTab, setActiveTab] = useState<RiskProfileKey>("BOM_PAGADOR");
  const [rulesByProfile, setRulesByProfile] = useState<Record<RiskProfileKey, ApiDunningRule | null>>({
    BOM_PAGADOR: null,
    DUVIDOSO: null,
    MAU_PAGADOR: null,
  });
  const [profileCounts, setProfileCounts] = useState<Record<RiskProfileKey, number>>({
    BOM_PAGADOR: 0,
    DUVIDOSO: 0,
    MAU_PAGADOR: 0,
  });
  const [loading, setLoading] = useState(true);
  const [confirmToggle, setConfirmToggle] = useState<{
    id: string;
    name: string;
    active: boolean;
    profile: RiskProfileKey;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const headers = getFranqueadoraHeaders();

    try {
      // Fetch risk scores for badge counts + all dunning rules
      const [scoresRes, rulesRes] = await Promise.all([
        fetch("/api/risk-scores", { headers }),
        fetch("/api/dunning-rules", { headers }),
      ]);

      // Process risk score counts
      if (scoresRes.ok) {
        const scores: RiskScoreEntry[] = await scoresRes.json();
        const counts: Record<RiskProfileKey, number> = {
          BOM_PAGADOR: 0,
          DUVIDOSO: 0,
          MAU_PAGADOR: 0,
        };
        for (const s of scores) {
          if (s.riskProfile in counts) {
            counts[s.riskProfile]++;
          }
        }
        setProfileCounts(counts);
      }

      // Process dunning rules — pick first rule per profile
      if (rulesRes.ok) {
        const allRules: ApiDunningRule[] = await rulesRes.json();
        const byProfile: Record<RiskProfileKey, ApiDunningRule | null> = {
          BOM_PAGADOR: null,
          DUVIDOSO: null,
          MAU_PAGADOR: null,
        };
        for (const rule of allRules) {
          if (rule.riskProfile && rule.riskProfile in byProfile && !byProfile[rule.riskProfile]) {
            byProfile[rule.riskProfile] = rule;
          }
        }
        setRulesByProfile(byProfile);
      }
    } catch (err) {
      console.error("Failed to fetch régua data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeFranqueadoraId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleToggle() {
    if (!confirmToggle) return;
    try {
      const res = await fetch(`/api/dunning-rules/${confirmToggle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getFranqueadoraHeaders() },
        body: JSON.stringify({ isActive: !confirmToggle.active }),
      });
      if (res.ok) {
        setRulesByProfile((prev) => {
          const rule = prev[confirmToggle.profile];
          if (!rule) return prev;
          return {
            ...prev,
            [confirmToggle.profile]: { ...rule, active: !rule.active },
          };
        });
      }
    } finally {
      setConfirmToggle(null);
    }
  }

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Réguas de Cobrança" />
        {/* Tab skeleton */}
        <div className="flex gap-1 border-b border-gray-200">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-t-lg" />
          ))}
        </div>
        {/* Card skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const currentRule = rulesByProfile[activeTab];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      <div className="space-y-6">
        <PageHeader title="Réguas de Cobrança" />

        {/* ── Tabs ── */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-0" aria-label="Perfis de risco">
            {RISK_PROFILES.map((profile) => {
              const isActive = activeTab === profile.key;
              return (
                <button
                  key={profile.key}
                  onClick={() => setActiveTab(profile.key)}
                  className={cn(
                    "relative px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30",
                    isActive
                      ? cn(profile.accent, profile.activeBg)
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  )}
                  aria-selected={isActive}
                  role="tab"
                >
                  <span className="flex items-center gap-2">
                    {profile.label}
                    <span
                      className={cn(
                        "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold",
                        isActive ? profile.badge : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {profileCounts[profile.key]}
                    </span>
                  </span>
                  {/* Active indicator bar */}
                  {isActive && (
                    <span
                      className={cn(
                        "absolute bottom-0 left-0 right-0 h-0.5",
                        profile.key === "BOM_PAGADOR" && "bg-emerald-500",
                        profile.key === "DUVIDOSO" && "bg-yellow-500",
                        profile.key === "MAU_PAGADOR" && "bg-red-500"
                      )}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Tab content ── */}
        {currentRule ? (
          <RuleCard
            rule={currentRule}
            profileKey={activeTab}
            onToggle={() =>
              setConfirmToggle({
                id: currentRule.id,
                name: currentRule.name,
                active: currentRule.active,
                profile: activeTab,
              })
            }
          />
        ) : (
          <FilterEmptyState
            message={`Nenhuma régua configurada para o perfil "${RISK_PROFILES.find((p) => p.key === activeTab)?.label}".`}
            suggestion="Crie uma régua padrão para automatizar cobranças desse perfil."
            actionLabel="Criar régua padrão"
            actionHref="/reguas/nova"
          />
        )}

        {/* ── Confirm toggle dialog ── */}
        <ConfirmDialog
          open={!!confirmToggle}
          onOpenChange={(open) => !open && setConfirmToggle(null)}
          title={confirmToggle?.active ? "Desativar régua?" : "Ativar régua?"}
          description={
            confirmToggle?.active
              ? `A régua "${confirmToggle.name}" deixará de enviar notificações automáticas. Você pode reativá-la a qualquer momento.`
              : `A régua "${confirmToggle?.name}" começará a enviar notificações automáticas para os clientes associados.`
          }
          confirmLabel={confirmToggle?.active ? "Desativar" : "Ativar"}
          variant={confirmToggle?.active ? "danger" : "default"}
          onConfirm={handleToggle}
        />
      </div>
    </>
  );
}

/* ── Rule Card with Timeline ── */

function RuleCard({
  rule,
  profileKey,
  onToggle,
}: {
  rule: ApiDunningRule;
  profileKey: RiskProfileKey;
  onToggle: () => void;
}) {
  // Group steps by phase
  const stepsByPhase: Record<string, ApiDunningStep[]> = {};
  for (const step of rule.steps) {
    const phase = step.phase || "LEMBRETE";
    if (!stepsByPhase[phase]) stepsByPhase[phase] = [];
    stepsByPhase[phase].push(step);
  }

  // Sort steps within each phase by offset
  for (const phase of Object.keys(stepsByPhase)) {
    stepsByPhase[phase].sort((a, b) => {
      const aVal = a.trigger === "BEFORE_DUE" ? -a.offsetDays : a.trigger === "ON_DUE" ? 0 : a.offsetDays;
      const bVal = b.trigger === "BEFORE_DUE" ? -b.offsetDays : b.trigger === "ON_DUE" ? 0 : b.offsetDays;
      return aVal - bVal;
    });
  }

  return (
    <div
      className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
      style={{
        animation: "regua-card-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{rule.name}</h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-gray-500">{rule.steps.length} etapas</span>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span className="text-xs text-gray-500">
                Até fase: {PHASE_LABELS[rule.maxPhase] || rule.maxPhase}
              </span>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span
                className={cn(
                  "text-xs font-medium",
                  rule.active ? "text-emerald-600" : "text-gray-400"
                )}
              >
                {rule.active ? "Ativa" : "Inativa"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Toggle */}
          <button
            onClick={onToggle}
            role="switch"
            aria-checked={rule.active}
            aria-label={rule.active ? `Desativar ${rule.name}` : `Ativar ${rule.name}`}
            className={cn(
              "relative h-[26px] w-[46px] rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30 focus-visible:ring-offset-2",
              rule.active ? "bg-emerald-500" : "bg-gray-200"
            )}
          >
            <span
              className={cn(
                "absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-soft transition-all duration-200",
                rule.active ? "left-[23px]" : "left-[3px]"
              )}
            />
          </button>

          {/* Edit button */}
          <Link
            href={`/reguas/${rule.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar régua
          </Link>
        </div>
      </div>

      {/* Phase bar */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {PHASE_ORDER.map((phase) => {
            const active = isPhaseActive(phase, rule.maxPhase);
            const colors = PHASE_COLORS[phase];
            return (
              <span
                key={phase}
                className={cn(
                  "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-opacity",
                  active ? cn(colors.bg, colors.text) : "opacity-30 bg-gray-200 text-gray-500"
                )}
              >
                {PHASE_LABELS[phase]}
              </span>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="border-t border-gray-50">
        <div
          className="overflow-x-auto px-6 py-6 scrollbar-none"
          tabIndex={0}
          aria-label="Timeline de etapas da régua"
        >
          <div className="relative min-w-max">
            {/* Group steps by phase in order */}
            <div className="flex items-start gap-0">
              {PHASE_ORDER.map((phase) => {
                const steps = stepsByPhase[phase];
                if (!steps || steps.length === 0) return null;
                const active = isPhaseActive(phase, rule.maxPhase);
                const phaseColors = PHASE_COLORS[phase];

                return (
                  <div
                    key={phase}
                    className={cn(
                      "flex flex-col items-stretch transition-opacity",
                      !active && "opacity-30"
                    )}
                  >
                    {/* Phase label for group */}
                    <div className="flex justify-center mb-3">
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded",
                          active ? cn(phaseColors.bg, phaseColors.text) : "bg-gray-100 text-gray-400"
                        )}
                      >
                        {PHASE_LABELS[phase]}
                      </span>
                    </div>

                    {/* Nodes row */}
                    <div className="flex items-start">
                      {steps.map((step, i) => {
                        const isEscalation = ESCALATION_CHANNELS.has(step.channel);
                        const ChannelIcon = CHANNEL_ICONS[step.channel] || Mail;
                        const offset = formatOffset(step.trigger, step.offsetDays);
                        const isDue = step.trigger === "ON_DUE" || step.offsetDays === 0;

                        return (
                          <div
                            key={step.id}
                            className="flex flex-col items-center"
                            style={{
                              minWidth: isEscalation ? 96 : 76,
                              animation: "regua-node-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                              animationDelay: `${0.15 + i * 0.05}s`,
                            }}
                          >
                            {/* Offset label */}
                            <span
                              className={cn(
                                "text-xs font-mono font-semibold mb-2 tracking-tight",
                                isDue ? "text-gray-900" : "text-gray-600"
                              )}
                              style={{
                                animation: "regua-pill-in 0.35s ease-out both",
                                animationDelay: `${0.2 + i * 0.04}s`,
                              }}
                            >
                              {offset}
                            </span>

                            {/* Node circle */}
                            <div
                              className={cn(
                                "relative flex items-center justify-center rounded-full",
                                isEscalation
                                  ? cn("h-12 w-12 ring-2 ring-offset-2", phaseColors.bg, phaseColors.text,
                                      phase === "NEGATIVACAO" && "ring-blue-800",
                                      phase === "PROTESTO" && "ring-gray-900",
                                      phase === "POS_PROTESTO" && "ring-gray-600",
                                      !["NEGATIVACAO", "PROTESTO", "POS_PROTESTO"].includes(phase) && "ring-gray-300"
                                    )
                                  : cn("h-8 w-8", phaseColors.bg, phaseColors.text)
                              )}
                            >
                              <ChannelIcon
                                className={cn(
                                  isEscalation ? "h-5 w-5" : "h-3.5 w-3.5"
                                )}
                                aria-hidden="true"
                              />
                            </div>

                            {/* Channel label */}
                            <span
                              className="mt-2 text-[10px] text-gray-500 font-medium text-center leading-tight"
                              style={{
                                animation: "regua-pill-in 0.35s ease-out both",
                                animationDelay: `${0.25 + i * 0.04}s`,
                              }}
                            >
                              {CHANNEL_LABELS[step.channel] || step.channel}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Connecting track line below nodes */}
                    {steps.length > 1 && (
                      <div className="flex justify-center mt-1">
                        <div
                          className={cn(
                            "h-0.5 rounded-full",
                            active ? phaseColors.bg : "bg-gray-200"
                          )}
                          style={{
                            width: `${(steps.length - 1) * 76}px`,
                            animation: "regua-track-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both",
                            transformOrigin: "left center",
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        {rule.steps.length > 8 && (
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
}
