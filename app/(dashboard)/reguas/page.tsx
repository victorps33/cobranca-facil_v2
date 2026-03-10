"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
  Maximize2,
  X,
} from "lucide-react";

/* ── Types ── */

type RiskProfileKey = "BOM_PAGADOR" | "DUVIDOSO" | "MAU_PAGADOR";

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

interface TimelineStep {
  id: string;
  offset: string;
  channel: string;
  phase: string;
  description: string;
  days: number;
}

type CampaignStatus = "DRAFT" | "ACTIVE" | "ENDED";

interface ApiCampaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  maxCashDiscount: number;
  maxInstallments: number;
  monthlyInterestRate: number;
  minInstallmentCents: number;
  targetFilters: Record<string, unknown> | null;
  steps: ApiDunningStep[];
  _count: { customers: number };
}

const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; className: string }> = {
  DRAFT: { label: "Rascunho", className: "bg-gray-100 text-gray-600" },
  ACTIVE: { label: "Ativa", className: "bg-emerald-50 text-emerald-700" },
  ENDED: { label: "Encerrada", className: "bg-gray-100 text-gray-400" },
};

/* ── Config ── */

const RISK_PROFILES: {
  key: RiskProfileKey;
  label: string;
  dot: string;
}[] = [
  { key: "BOM_PAGADOR", label: "Bom Pagador", dot: "#85ACE6" },
  { key: "DUVIDOSO", label: "Duvidoso", dot: "#94a3b8" },
  { key: "MAU_PAGADOR", label: "Mau Pagador", dot: "#F85B00" },
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

const CHANNEL_META: Record<string, { icon: typeof Mail; label: string }> = {
  EMAIL: { icon: Mail, label: "Email" },
  SMS: { icon: MessageSquare, label: "SMS" },
  WHATSAPP: { icon: MessageCircle, label: "WhatsApp" },
  LIGACAO: { icon: Phone, label: "Ligação" },
  BOA_VISTA: { icon: ShieldAlert, label: "Boa Vista" },
  CARTORIO: { icon: FileText, label: "Cartório" },
  JURIDICO: { icon: Scale, label: "Jurídico" },
};

/* ── Helpers ── */

function formatOffset(trigger: string, offsetDays: number): string {
  if (trigger === "ON_DUE" || offsetDays === 0) return "D0";
  if (trigger === "BEFORE_DUE") return `D-${offsetDays}`;
  return `D+${offsetDays}`;
}

function stepDescription(trigger: string, offsetDays: number, channel: string): string {
  const label = CHANNEL_META[channel]?.label || channel;
  if (trigger === "BEFORE_DUE") {
    return offsetDays === 1
      ? `Aviso véspera via ${label}`
      : `Lembrete ${offsetDays} dias antes via ${label}`;
  }
  if (trigger === "ON_DUE") return `Cobrança no vencimento via ${label}`;
  return offsetDays <= 3
    ? `Cobrança vencida via ${label}`
    : `Último aviso via ${label}`;
}

function isPhaseActive(phase: string, maxPhase: string): boolean {
  const phaseIdx = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
  const maxIdx = PHASE_ORDER.indexOf(maxPhase as (typeof PHASE_ORDER)[number]);
  if (phaseIdx === -1 || maxIdx === -1) return false;
  return phaseIdx <= maxIdx;
}

function channelSummary(steps: ApiDunningStep[]): string {
  const counts: Record<string, number> = {};
  for (const s of steps) {
    const label = CHANNEL_META[s.channel]?.label || s.channel;
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([ch, n]) => `${n}x ${ch}`)
    .join(" · ");
}

function toTimelineSteps(steps: ApiDunningStep[]): TimelineStep[] {
  return steps
    .map((s) => ({
      id: s.id,
      offset: formatOffset(s.trigger, s.offsetDays),
      channel: s.channel,
      phase: s.phase || "LEMBRETE",
      description: stepDescription(s.trigger, s.offsetDays, s.channel),
      days:
        s.trigger === "BEFORE_DUE"
          ? -s.offsetDays
          : s.trigger === "ON_DUE"
            ? 0
            : s.offsetDays,
    }))
    .sort((a, b) => a.days - b.days);
}

function computePositions(
  sorted: { days: number }[],
  minGapPx: number
): { positions: number[]; totalWidth: number } {
  if (sorted.length === 0) return { positions: [], totalWidth: 0 };
  if (sorted.length === 1) return { positions: [0], totalWidth: 0 };

  const n = sorted.length;
  const minDay = sorted[0].days;
  const maxDay = sorted[n - 1].days;
  const range = maxDay - minDay || 1;

  const ratios = sorted.map((s) => (s.days - minDay) / range);
  const minTotalWidth = minGapPx * (n - 1);
  const positions = ratios.map((r) => r * minTotalWidth);

  for (let i = 1; i < n; i++) {
    if (positions[i] - positions[i - 1] < minGapPx) {
      positions[i] = positions[i - 1] + minGapPx;
    }
  }

  return { positions, totalWidth: positions[n - 1] };
}

/* ── Keyframes ── */

const KEYFRAMES = `
@keyframes regua-card-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes regua-node-in {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes regua-track-in {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes regua-d0-ring {
  0% { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(2.2); opacity: 0; }
}
@keyframes regua-modal-in {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes regua-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes regua-tooltip-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

/* ── Styled Tooltip ── */

function StepTooltip({
  step,
  visible,
}: {
  step: TimelineStep;
  visible: boolean;
}) {
  if (!visible) return null;
  const meta = CHANNEL_META[step.channel];
  const ChannelIcon = meta?.icon || Mail;
  const channelLabel = meta?.label || step.channel;
  const phaseLabel = PHASE_LABELS[step.phase] || step.phase;

  return (
    <div
      className="absolute left-1/2 bottom-full mb-2 z-30 pointer-events-none"
      style={{
        transform: "translateX(-50%)",
        animation: "regua-tooltip-in 0.15s ease-out both",
      }}
    >
      <div className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg whitespace-nowrap">
        <div className="flex items-center gap-1.5 font-semibold">
          <ChannelIcon className="h-3 w-3" />
          <span>{channelLabel}</span>
          <span className="text-gray-400 font-mono ml-1">{step.offset}</span>
        </div>
        <p className="text-gray-300 mt-0.5 font-normal">{step.description}</p>
        <p className="text-gray-500 mt-0.5 text-[10px]">{phaseLabel}</p>
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-gray-900" />
      </div>
    </div>
  );
}

/* ── Scroll Fade Container ── */

function ScrollFadeContainer({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 4);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkScroll]);

  return (
    <div className={cn("relative", className)}>
      {showLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      )}
      {showRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
      )}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        onClick={onClick}
        className={cn("overflow-x-auto", onClick && "cursor-pointer")}
        tabIndex={0}
        aria-label="Timeline de etapas da régua"
      >
        {children}
      </div>
    </div>
  );
}

/* ── Phase Progress Bar (fullscreen only) ── */

function PhaseProgressBar({ maxPhase, compact }: { maxPhase: string; compact?: boolean }) {
  return (
    <div className={cn("flex", compact ? "gap-0.5" : "gap-1")}>
      {PHASE_ORDER.map((phase, i) => {
        const active = isPhaseActive(phase, maxPhase);
        const isMax = phase === maxPhase;
        return (
          <div key={phase} className={cn("flex flex-col items-center flex-1 min-w-0", compact ? "gap-1" : "gap-1.5")}>
            <div
              className={cn(
                "w-full rounded-sm",
                compact ? "h-[3px]" : "h-1.5",
                i === 0 && "rounded-l-full",
                i === PHASE_ORDER.length - 1 && "rounded-r-full",
                active ? "bg-[#85ACE6]" : "bg-gray-100"
              )}
            />
            <span
              className={cn(
                "truncate w-full text-center leading-none",
                compact ? "text-[9px]" : "text-[11px]",
                isMax
                  ? "text-gray-900 font-semibold"
                  : active
                    ? "text-gray-900 font-medium"
                    : "text-gray-300 font-medium"
              )}
            >
              {PHASE_LABELS[phase]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Page ── */

export default function ReguasPage() {
  const { activeFranqueadoraId } = useFranqueadora();
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
  const [fullscreenRule, setFullscreenRule] = useState<ApiDunningRule | null>(null);
  const [activeSection, setActiveSection] = useState<"reguas" | "campanhas">("reguas");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const headers = getFranqueadoraHeaders();
    try {
      const [scoresRes, rulesRes] = await Promise.all([
        fetch("/api/risk-scores", { headers }),
        fetch("/api/dunning-rules", { headers }),
      ]);

      if (scoresRes.ok) {
        const scores: RiskScoreEntry[] = await scoresRes.json();
        const counts: Record<RiskProfileKey, number> = { BOM_PAGADOR: 0, DUVIDOSO: 0, MAU_PAGADOR: 0 };
        for (const s of scores) {
          if (s.riskProfile in counts) counts[s.riskProfile]++;
        }
        setProfileCounts(counts);
      }

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
          return { ...prev, [confirmToggle.profile]: { ...rule, active: !rule.active } };
        });
      }
    } finally {
      setConfirmToggle(null);
    }
  }

  useEffect(() => {
    if (!fullscreenRule) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreenRule(null);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [fullscreenRule]);

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Réguas de Cobrança" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      <div className="space-y-5 min-w-0 overflow-hidden">
        <PageHeader title="Réguas de Cobrança" />

        {/* Section tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-0" role="tablist" aria-label="Seções">
            {[
              { key: "reguas" as const, label: "Réguas Padrão" },
              { key: "campanhas" as const, label: "Campanhas" },
            ].map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeSection === tab.key}
                onClick={() => setActiveSection(tab.key)}
                className={cn(
                  "relative px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                  activeSection === tab.key
                    ? "text-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                {tab.label}
                {activeSection === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {activeSection === "reguas" ? (
          <>
            {RISK_PROFILES.map((profile) => {
              const rule = rulesByProfile[profile.key];
              return (
                <div key={profile.key}>
                  {rule ? (
                    <RuleCard
                      rule={rule}
                      profile={profile}
                      customerCount={profileCounts[profile.key]}
                      onToggle={() =>
                        setConfirmToggle({
                          id: rule.id,
                          name: rule.name,
                          active: rule.active,
                          profile: profile.key,
                        })
                      }
                      onExpand={() => setFullscreenRule(rule)}
                    />
                  ) : (
                    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-50">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: profile.dot }}
                        />
                        <span className="text-xs text-gray-400 font-medium">{profile.label}</span>
                        <span className="text-gray-200">·</span>
                        <span className="text-xs text-gray-400">{profileCounts[profile.key]} clientes</span>
                      </div>
                      <div className="px-6 py-8">
                        <FilterEmptyState
                          message={`Nenhuma régua configurada para "${profile.label}".`}
                          suggestion="Crie uma régua para automatizar cobranças desse perfil."
                          actionLabel="Criar régua"
                          actionHref="/reguas/nova"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <CampaignsSection key={activeFranqueadoraId} />
        )}

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

      {fullscreenRule && (
        <FullscreenTimeline
          rule={fullscreenRule}
          onClose={() => setFullscreenRule(null)}
        />
      )}
    </>
  );
}

/* ── Timeline View ── */

function TimelineView({
  sorted,
  d0Index,
  size,
}: {
  sorted: TimelineStep[];
  d0Index: number;
  size: "compact" | "full";
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const isCompact = size === "compact";

  const nodeSize = isCompact ? 28 : 48;
  const d0NodeSize = isCompact ? 36 : 56;
  const iconSize = isCompact ? 12 : 20;
  const d0IconSize = isCompact ? 16 : 24;
  const minGap = isCompact ? 56 : 88;

  const { positions, totalWidth } = computePositions(sorted, minGap);
  const pad = isCompact ? 20 : 36;
  const containerWidth = totalWidth + pad * 2;
  const trackTop = isCompact ? 30 : 46;

  return (
    <div className="relative" style={{ width: containerWidth, height: isCompact ? 80 : 130 }}>
      {/* Track */}
      <div className="absolute flex items-center" style={{ top: trackTop, left: pad, right: pad }}>
        <div
          className="w-full h-[2px] rounded-full bg-gray-200"
          style={{
            animation: "regua-track-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both",
            transformOrigin: "left center",
          }}
        />
      </div>

      {/* Nodes */}
      {sorted.map((step, i) => {
        const meta = CHANNEL_META[step.channel];
        const ChannelIcon = meta?.icon || Mail;
        const channelLabel = meta?.label || step.channel;
        const isDue = step.days === 0;
        const isEscalation = step.phase === "PROTESTO" || step.channel === "BOA_VISTA";
        const isAccent = isDue || isEscalation;
        const sz = isAccent ? d0NodeSize : nodeSize;
        const ic = isAccent ? d0IconSize : iconSize;

        return (
          <div
            key={step.id}
            className="absolute flex flex-col items-center"
            style={{
              left: positions[i] + pad,
              transform: "translateX(-50%)",
              top: 0,
              width: minGap,
              animation: "regua-node-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
              animationDelay: `${0.1 + i * 0.025}s`,
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <StepTooltip step={step} visible={hoveredIdx === i} />

            {/* Offset label */}
            <span
              className={cn(
                "font-mono font-semibold tracking-tight whitespace-nowrap leading-none",
                isAccent ? "text-gray-900" : "text-gray-400",
                isCompact ? "text-[10px] mb-1" : "text-xs mb-2"
              )}
            >
              {step.offset}
            </span>

            {/* Node */}
            <div className="relative z-10">
              {isAccent && (
                <span
                  className="absolute inset-0 rounded-full bg-[var(--menlo-orange)]"
                  style={{ animation: "regua-d0-ring 2.5s ease-out 1s infinite" }}
                />
              )}
              <div
                className={cn(
                  "relative flex items-center justify-center rounded-full transition-transform duration-150",
                  hoveredIdx === i && "scale-110",
                  isAccent
                    ? "bg-[var(--menlo-orange)] text-white"
                    : "bg-gray-100 text-gray-400 ring-1 ring-gray-200"
                )}
                style={{
                  width: sz,
                  height: sz,
                  ...(isAccent ? { boxShadow: "0 2px 8px -2px rgba(248, 91, 0, 0.25)" } : {}),
                }}
              >
                <ChannelIcon style={{ width: ic, height: ic }} />
              </div>
            </div>

            {/* Channel label */}
            <span
              className={cn(
                "font-medium text-center whitespace-nowrap leading-none",
                isAccent ? "text-[var(--menlo-orange)]" : "text-gray-400",
                isCompact ? "mt-1 text-[8px]" : "mt-2 text-[11px]"
              )}
            >
              {channelLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Rule Card ── */

function RuleCard({
  rule,
  profile,
  customerCount,
  onToggle,
  onExpand,
}: {
  rule: ApiDunningRule;
  profile: (typeof RISK_PROFILES)[number];
  customerCount: number;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const sorted = toTimelineSteps(rule.steps);
  const d0Index = sorted.findIndex((s) => s.days === 0);

  return (
    <div
      className={cn(
        "group/card rounded-2xl border border-gray-100 bg-white transition-colors duration-200 overflow-hidden hover:border-gray-200 min-w-0",
        !rule.active && "opacity-60 hover:opacity-80"
      )}
      style={{ animation: "regua-card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{rule.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {rule.steps.length} etapas · Até {PHASE_LABELS[rule.maxPhase] || rule.maxPhase} · {customerCount} clientes
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggle}
            role="switch"
            aria-checked={rule.active}
            aria-label={rule.active ? `Desativar ${rule.name}` : `Ativar ${rule.name}`}
            className={cn(
              "relative h-[26px] w-[46px] rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2",
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

          <Link
            href={`/reguas/${rule.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Link>
        </div>
      </div>

      {/* Phase bar */}
      <div className="px-6 py-2.5 border-t border-gray-50">
        <PhaseProgressBar maxPhase={rule.maxPhase} compact />
      </div>

      {/* Timeline */}
      <div className="border-t border-gray-50 relative">
        <div className="relative">
          <button
            onClick={onExpand}
            className="absolute top-3 right-3 z-20 p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors opacity-0 group-hover/card:opacity-100"
            aria-label="Expandir timeline"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <ScrollFadeContainer className="px-4 py-4" onClick={onExpand}>
            <TimelineView sorted={sorted} d0Index={d0Index} size="compact" />
          </ScrollFadeContainer>
        </div>
      </div>
    </div>
  );
}

/* ── Campaigns Section ── */

function CampaignsSection() {
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const headers = getFranqueadoraHeaders();
    fetch("/api/negotiation-campaigns", { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setCampaigns)
      .catch((err) => {
        console.error("Failed to fetch campaigns:", err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <FilterEmptyState
        message="Erro ao carregar campanhas."
        suggestion="Tente recarregar a página."
      />
    );
  }

  if (campaigns.length === 0) {
    return (
      <FilterEmptyState
        message="Nenhuma campanha de negociação criada."
        suggestion="Crie uma campanha para oferecer condições especiais de renegociação."
        actionLabel="Criar campanha"
        actionHref="/reguas/campanhas/nova"
      />
    );
  }

  return (
    <div className="space-y-5">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}

/* ── Campaign Card ── */

function CampaignCard({ campaign }: { campaign: ApiCampaign }) {
  const sorted = toTimelineSteps(campaign.steps);
  const d0Index = sorted.findIndex((s) => s.days === 0);
  const status = CAMPAIGN_STATUS[campaign.status];
  const start = new Date(campaign.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const end = new Date(campaign.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <div
      className={cn(
        "group/card rounded-2xl border border-gray-100 bg-white transition-colors duration-200 overflow-hidden hover:border-gray-200 min-w-0",
        campaign.status === "ENDED" && "opacity-60"
      )}
      style={{ animation: "regua-card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{campaign.name}</h3>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", status.className)}>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {start} — {end} · {campaign._count.customers} clientes · {campaign.steps.length} etapas
          </p>
        </div>
        <Link
          href={`/reguas/campanhas/${campaign.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Link>
      </div>

      {/* Commercial terms */}
      <div className="px-6 pb-3 flex gap-4 text-[11px] text-gray-400">
        <span>Desconto até {(campaign.maxCashDiscount * 100).toFixed(0)}%</span>
        <span>·</span>
        <span>Até {campaign.maxInstallments}x</span>
        <span>·</span>
        <span>Juros {(campaign.monthlyInterestRate * 100).toFixed(1)}% a.m.</span>
      </div>

      {/* Timeline */}
      {sorted.length > 0 && (
        <div className="border-t border-gray-50">
          <ScrollFadeContainer className="px-4 py-4">
            <TimelineView sorted={sorted} d0Index={d0Index} size="compact" />
          </ScrollFadeContainer>
        </div>
      )}
    </div>
  );
}

/* ── Fullscreen Modal ── */

function FullscreenTimeline({
  rule,
  onClose,
}: {
  rule: ApiDunningRule;
  onClose: () => void;
}) {
  const sorted = toTimelineSteps(rule.steps);
  const d0Index = sorted.findIndex((s) => s.days === 0);
  const usedChannels = Array.from(new Set(rule.steps.map((s) => s.channel)));

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ animation: "regua-backdrop-in 0.2s ease-out both" }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-[95vw] max-w-[1400px] bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: "regua-modal-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{rule.name}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {rule.steps.length} etapas · Até {PHASE_LABELS[rule.maxPhase] || rule.maxPhase}
              <span className="ml-3 text-gray-300">{channelSummary(rule.steps)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Phase bar */}
        <div className="px-8 pt-4 pb-3 border-b border-gray-50">
          <PhaseProgressBar maxPhase={rule.maxPhase} />
        </div>

        {/* Timeline */}
        <ScrollFadeContainer className="px-12 py-10">
          <div className="flex justify-center">
            <TimelineView sorted={sorted} d0Index={d0Index} size="full" />
          </div>
        </ScrollFadeContainer>

        {/* Channel legend */}
        <div className="flex items-center justify-center gap-6 px-8 py-4 border-t border-gray-100 bg-gray-50/50">
          {usedChannels.map((ch) => {
            const meta = CHANNEL_META[ch];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <div key={ch} className="flex items-center gap-1.5 text-xs text-gray-500">
                <Icon className="h-3.5 w-3.5 text-gray-400" />
                <span>{meta.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
