"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import {
  Bell,
  Mail,
  MessageSquare,
  Phone,
  ChevronRight,
  Loader2,
} from "lucide-react";

/* ── Types ── */

interface ApiDunningStep {
  id: string;
  trigger: "BEFORE_DUE" | "ON_DUE" | "AFTER_DUE";
  offsetDays: number;
  channel: "EMAIL" | "SMS" | "WHATSAPP";
  template: string;
  enabled: boolean;
}

interface ApiDunningRule {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  steps: ApiDunningStep[];
}

interface ReguaStep {
  id: string;
  offset: string;
  channel: "Email" | "SMS" | "WhatsApp" | "Telefone";
  description: string;
}

interface Regua {
  id: string;
  name: string;
  description: string;
  active: boolean;
  steps: ReguaStep[];
}

/* ── Config ── */

const CHANNEL_MAP: Record<string, "Email" | "SMS" | "WhatsApp"> = {
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
};

const CHANNEL_META: Record<string, { icon: typeof Mail; label: string }> = {
  Email: { icon: Mail, label: "Email" },
  SMS: { icon: MessageSquare, label: "SMS" },
  WhatsApp: { icon: MessageSquare, label: "WhatsApp" },
  Telefone: { icon: Phone, label: "Telefone" },
};

/* ── Helpers ── */

function formatOffset(trigger: string, offsetDays: number): string {
  if (trigger === "ON_DUE" || offsetDays === 0) return "D0";
  if (trigger === "BEFORE_DUE") return `D-${offsetDays}`;
  return `D+${offsetDays}`;
}

function stepDescription(trigger: string, offsetDays: number, channel: string): string {
  const channelLabel = CHANNEL_MAP[channel] || channel;
  if (trigger === "BEFORE_DUE") {
    return offsetDays === 1
      ? `Aviso véspera via ${channelLabel}`
      : `Lembrete ${offsetDays} dias antes via ${channelLabel}`;
  }
  if (trigger === "ON_DUE") return `Cobrança no vencimento via ${channelLabel}`;
  return offsetDays <= 3
    ? `Cobrança vencida via ${channelLabel}`
    : `Último aviso via ${channelLabel}`;
}

function mapApiToRegua(rule: ApiDunningRule): Regua {
  const steps: ReguaStep[] = rule.steps.map((s) => ({
    id: s.id,
    offset: formatOffset(s.trigger, s.offsetDays),
    channel: CHANNEL_MAP[s.channel] || "Email",
    description: stepDescription(s.trigger, s.offsetDays, s.channel),
  }));

  return {
    id: rule.id,
    name: rule.name,
    description: `${rule.steps.length} etapas de cobrança automática`,
    active: rule.active,
    steps,
  };
}

function parseOffset(offset: string): number {
  if (offset === "D0") return 0;
  const sign = offset.startsWith("D-") ? -1 : 1;
  const num = parseInt(offset.replace(/D[+-]?/, ""), 10);
  return sign * num;
}

/* ── Keyframes (injected once) ── */

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
@keyframes regua-d0-ring {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(2); opacity: 0; }
}
@keyframes regua-pill-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

/* ── Page ── */

export default function ReguasPage() {
  const [reguas, setReguas] = useState<Regua[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [confirmToggle, setConfirmToggle] = useState<{ id: string; name: string; active: boolean } | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch("/api/dunning-rules")
      .then((r) => r.json())
      .then((rules: ApiDunningRule[]) => {
        setReguas(rules.map(mapApiToRegua));
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredReguas =
    activeFilter === "all"
      ? reguas
      : activeFilter === "active"
        ? reguas.filter((r) => r.active)
        : reguas.filter((r) => !r.active);

  function requestToggle(id: string) {
    const regua = reguas.find((r) => r.id === id);
    if (regua) setConfirmToggle({ id, name: regua.name, active: regua.active });
  }

  async function executeToggle() {
    if (!confirmToggle) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/dunning-rules/${confirmToggle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !confirmToggle.active }),
      });
      if (res.ok) {
        setReguas((prev) =>
          prev.map((r) => (r.id === confirmToggle.id ? { ...r, active: !r.active } : r))
        );
      }
    } finally {
      setToggling(false);
      setConfirmToggle(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Réguas de Cobrança" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Inject keyframes */}
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      <PageHeader
        title="Réguas de Cobrança"
        primaryAction={{ label: "Nova Régua", onClick: () => {} }}
      />

      {/* Filters */}
      <FilterPillGroup
        options={[
          { key: "all", label: "Todas" },
          { key: "active", label: "Ativas" },
          { key: "inactive", label: "Inativas" },
        ]}
        value={activeFilter}
        onChange={setActiveFilter}
      />

      {filteredReguas.length === 0 ? (
        <FilterEmptyState
          message={
            activeFilter !== "all"
              ? "Nenhuma régua encontrada para o filtro selecionado."
              : "Nenhuma régua cadastrada. Crie uma para automatizar cobranças."
          }
          icon={<Bell className="h-6 w-6 text-gray-400" />}
          onClear={activeFilter !== "all" ? () => setActiveFilter("all") : undefined}
        />
      ) : (
        <div className="space-y-4">
          {filteredReguas.map((regua, i) => (
            <div
              key={regua.id}
              style={{
                animation: "regua-card-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
                animationDelay: `${i * 70}ms`,
              }}
            >
              <ReguaCard regua={regua} onToggle={() => requestToggle(regua.id)} />
            </div>
          ))}
        </div>
      )}

      {/* Confirm toggle dialog */}
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
        onConfirm={executeToggle}
      />
    </div>
  );
}

/* ── Card ── */

function ReguaCard({ regua, onToggle }: { regua: Regua; onToggle: () => void }) {
  const sorted = [...regua.steps]
    .map((s) => ({ ...s, days: parseOffset(s.offset) }))
    .sort((a, b) => a.days - b.days);

  const d0Index = sorted.findIndex((s) => s.days === 0);

  return (
    <div
      className={cn(
        "group rounded-2xl border bg-white transition-all duration-200 overflow-hidden",
        regua.active
          ? "border-gray-100 shadow-soft hover:shadow-medium hover:border-gray-200"
          : "border-gray-100 opacity-60 hover:opacity-80"
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: regua.active ? "#10b981" : "#d1d5db" }}
    >
      {/* Header */}
      <Link
        href={`/reguas/${regua.id}`}
        className="flex items-center gap-4 px-6 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary/30"
      >
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          regua.active ? "bg-emerald-100" : "bg-gray-100"
        )}>
          <Bell className={cn("h-[18px] w-[18px]", regua.active ? "text-emerald-600" : "text-gray-400")} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{regua.name}</h3>
          <p className="text-xs text-gray-500 truncate mt-0.5">{regua.description}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500">{regua.steps.length} etapas</span>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <span className={cn(
              "text-xs font-medium",
              regua.active ? "text-emerald-600" : "text-gray-400"
            )}>
              {regua.active ? "Ativa" : "Inativa"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
            role="switch"
            aria-checked={regua.active}
            aria-label={regua.active ? `Desativar ${regua.name}` : `Ativar ${regua.name}`}
            className={cn(
              "relative h-[26px] w-[46px] rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30 focus-visible:ring-offset-2",
              regua.active ? "bg-emerald-500" : "bg-gray-200"
            )}
          >
            <span
              className={cn(
                "absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-soft transition-all duration-200",
                regua.active ? "left-[23px]" : "left-[3px]"
              )}
            />
          </button>
          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors" aria-hidden="true" />
        </div>
      </Link>

      {/* Timeline area */}
      <div className="border-t border-gray-100 relative">
        {/* Subtle radial glow behind D0 position */}
        {d0Index >= 0 && (
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              background: `radial-gradient(ellipse at ${((d0Index + 0.5) / sorted.length) * 100}% 50%, var(--menlo-orange) 0%, transparent 60%)`,
            }}
          />
        )}

        <div className="relative">
          <div
            className="overflow-x-auto px-6 py-6 scrollbar-none"
            tabIndex={0}
            aria-label="Timeline de etapas da régua"
          >
            <div className="relative min-w-max">
              {/* Track line (animated) */}
              <div className="absolute left-0 right-0 flex items-center" style={{ top: 40 }}>
                <div className="w-full h-1 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: d0Index >= 0
                        ? `linear-gradient(to right, #e5e7eb 0%, #e5e7eb ${((d0Index / Math.max(sorted.length - 1, 1)) * 100 - 5)}%, var(--menlo-orange) ${(d0Index / Math.max(sorted.length - 1, 1)) * 100}%, #fcd34d ${((d0Index / Math.max(sorted.length - 1, 1)) * 100 + 5)}%, #fcd34d 100%)`
                        : "linear-gradient(to right, #e5e7eb, #fcd34d)",
                      animation: "regua-track-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both",
                      transformOrigin: "left center",
                    }}
                  />
                </div>
              </div>

              {/* Nodes */}
              <div className="relative flex items-start">
                {sorted.map((step, i) => {
                  const ChannelIcon = CHANNEL_META[step.channel]?.icon || Mail;
                  const channelLabel = CHANNEL_META[step.channel]?.label || step.channel;
                  const isDue = step.days === 0;
                  const isAfter = step.days > 0;

                  return (
                    <div
                      key={step.id}
                      className="flex items-start flex-1"
                      style={{ minWidth: 76 }}
                    >
                      <div
                        className="flex flex-col items-center flex-1 group/step"
                        role="listitem"
                        aria-label={`${step.offset}: ${step.description} via ${step.channel}`}
                      >
                        {/* Offset */}
                        <span
                          className={cn(
                            "text-xs font-mono font-semibold mb-3 tracking-tight",
                            isDue ? "text-gray-900" : "text-gray-600"
                          )}
                          style={{
                            animation: "regua-pill-in 0.35s ease-out both",
                            animationDelay: `${0.3 + i * 0.04}s`,
                          }}
                        >
                          {step.offset}
                        </span>

                        {/* Node */}
                        <div
                          className="relative z-10"
                          style={{
                            animation: "regua-node-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                            animationDelay: `${0.25 + i * 0.05}s`,
                          }}
                        >
                          {/* D0 pulse ring */}
                          {isDue && (
                            <span
                              className="absolute inset-0 rounded-full bg-[var(--menlo-orange)]"
                              style={{ animation: "regua-d0-ring 2s ease-out 1s infinite" }}
                            />
                          )}
                          <div
                            className={cn(
                              "relative flex items-center justify-center rounded-full transition-transform duration-200 group-hover/step:scale-110",
                              isDue
                                ? "h-10 w-10 bg-[var(--menlo-orange)] text-white shadow-lg"
                                : isAfter
                                  ? "h-7 w-7 bg-amber-100 text-amber-800 ring-2 ring-white"
                                  : "h-7 w-7 bg-gray-200 text-gray-700 ring-2 ring-white"
                            )}
                            style={isDue ? { boxShadow: "0 4px 14px -2px rgba(248, 91, 0, 0.35)" } : undefined}
                          >
                            <span className={cn("font-bold tabular-nums", isDue ? "text-sm" : "text-[11px]")}>
                              {step.days === 0 ? "0" : Math.abs(step.days)}
                            </span>
                          </div>
                        </div>

                        {/* Channel pill */}
                        <div
                          className={cn(
                            "mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-200",
                            isDue
                              ? "bg-[var(--menlo-orange)]/10 text-[var(--menlo-orange)]"
                              : isAfter
                                ? "bg-amber-50 text-amber-700 group-hover/step:bg-amber-100"
                                : "bg-gray-100 text-gray-600 group-hover/step:bg-gray-200"
                          )}
                          style={{
                            animation: "regua-pill-in 0.35s ease-out both",
                            animationDelay: `${0.4 + i * 0.04}s`,
                          }}
                        >
                          <ChannelIcon className="h-3 w-3" aria-hidden="true" />
                          <span>{channelLabel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scroll fade hint */}
          {sorted.length > 6 && (
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none" />
          )}
        </div>
      </div>
    </div>
  );
}
