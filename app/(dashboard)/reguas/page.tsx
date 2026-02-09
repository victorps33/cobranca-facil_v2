"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterEmptyState } from "@/components/layout/FilterEmptyState";
import { FilterPillGroup } from "@/components/ui/filter-pills";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/cn";
import {
  Bell,
  Mail,
  MessageSquare,
  Phone,
  UserPlus,
  UserCheck,
  AlertTriangle,
  ShieldAlert,
  Users,
  ChevronRight,
} from "lucide-react";

/* ── Types ── */

interface ReguaStep {
  id: string;
  offset: string;
  channel: "Email" | "SMS" | "WhatsApp" | "Telefone";
  description: string;
}

type ProfileIcon = "new" | "good" | "risky" | "bad";

interface Regua {
  id: string;
  name: string;
  description: string;
  active: boolean;
  clientCount: number;
  profileIcon: ProfileIcon;
  steps: ReguaStep[];
}

/* ── Data ── */

const REGUAS_DATA: Regua[] = [
  {
    id: "R1",
    name: "Novo Cliente",
    description: "Régua principal de cobrança para novos franqueados",
    active: true,
    clientCount: 3,
    profileIcon: "new",
    steps: [
      { id: "s1", offset: "D-5", channel: "Email", description: "Lembrete de vencimento próximo" },
      { id: "s2", offset: "D-1", channel: "WhatsApp", description: "Aviso de vencimento amanhã" },
      { id: "s3", offset: "D0", channel: "Email", description: "Cobrança no dia do vencimento" },
      { id: "s4", offset: "D+3", channel: "SMS", description: "Notificação de atraso" },
      { id: "s5", offset: "D+7", channel: "Telefone", description: "Contato direto por telefone" },
    ],
  },
  {
    id: "R2",
    name: "Bom Pagador",
    description: "Régua suave para franqueados prioritários",
    active: false,
    clientCount: 25,
    profileIcon: "good",
    steps: [
      { id: "s1", offset: "D-3", channel: "Email", description: "Lembrete gentil" },
      { id: "s2", offset: "D+5", channel: "WhatsApp", description: "Follow-up educado" },
    ],
  },
  {
    id: "R3",
    name: "Pagador Duvidoso",
    description: "Régua agressiva para inadimplentes recorrentes",
    active: true,
    clientCount: 8,
    profileIcon: "risky",
    steps: [
      { id: "s1", offset: "D-7", channel: "Email", description: "Alerta antecipado" },
      { id: "s2", offset: "D-1", channel: "SMS", description: "Urgência de pagamento" },
      { id: "s3", offset: "D0", channel: "WhatsApp", description: "Cobrança imediata" },
      { id: "s4", offset: "D+1", channel: "Telefone", description: "Ligação no dia seguinte" },
      { id: "s5", offset: "D+3", channel: "Email", description: "Aviso de protesto" },
      { id: "s6", offset: "D+7", channel: "Telefone", description: "Última tentativa antes de protesto" },
    ],
  },
  {
    id: "R4",
    name: "Mau Pagador",
    description: "Régua intensiva para clientes com alto índice de inadimplência",
    active: true,
    clientCount: 2,
    profileIcon: "bad",
    steps: [
      { id: "s1", offset: "D-7", channel: "Email", description: "Aviso antecipado formal" },
      { id: "s2", offset: "D-3", channel: "WhatsApp", description: "Lembrete urgente" },
      { id: "s3", offset: "D-1", channel: "SMS", description: "Último aviso antes do vencimento" },
      { id: "s4", offset: "D0", channel: "Telefone", description: "Cobrança imediata por telefone" },
      { id: "s5", offset: "D+1", channel: "Email", description: "Notificação de inadimplência" },
      { id: "s6", offset: "D+3", channel: "Telefone", description: "Ligação de cobrança" },
      { id: "s7", offset: "D+5", channel: "WhatsApp", description: "Aviso de negativação" },
      { id: "s8", offset: "D+7", channel: "Email", description: "Notificação de protesto" },
      { id: "s9", offset: "D+15", channel: "Telefone", description: "Última tentativa — encaminhamento jurídico" },
    ],
  },
];

/* ── Config ── */

const PROFILE_CONFIG: Record<
  ProfileIcon,
  { icon: typeof UserPlus; color: string; bg: string; accent: string }
> = {
  new: { icon: UserPlus, color: "text-violet-600", bg: "bg-violet-100", accent: "#8b5cf6" },
  good: { icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-100", accent: "#10b981" },
  risky: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-100", accent: "#f59e0b" },
  bad: { icon: ShieldAlert, color: "text-rose-600", bg: "bg-rose-100", accent: "#f43f5e" },
};

const CHANNEL_META: Record<string, { icon: typeof Mail; label: string }> = {
  Email: { icon: Mail, label: "Email" },
  SMS: { icon: MessageSquare, label: "SMS" },
  WhatsApp: { icon: MessageSquare, label: "WhatsApp" },
  Telefone: { icon: Phone, label: "Telefone" },
};

/* ── Helpers ── */

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
  const [reguas, setReguas] = useState(REGUAS_DATA);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [confirmToggle, setConfirmToggle] = useState<{ id: string; name: string; active: boolean } | null>(null);

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

  function executeToggle() {
    if (!confirmToggle) return;
    setReguas((prev) =>
      prev.map((r) => (r.id === confirmToggle.id ? { ...r, active: !r.active } : r))
    );
    setConfirmToggle(null);
  }

  return (
    <div className="space-y-6">
      {/* Inject keyframes */}
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      <PageHeader
        title="Réguas de Cobrança"
        subtitle="Configure fluxos automáticos de notificação"
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
  const profile = PROFILE_CONFIG[regua.profileIcon];
  const Icon = profile.icon;

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
      style={{ borderLeftWidth: 3, borderLeftColor: profile.accent }}
    >
      {/* Header */}
      <Link
        href={`/reguas/${regua.id}`}
        className="flex items-center gap-4 px-6 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary/50"
      >
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", profile.bg)}>
          <Icon className={cn("h-[18px] w-[18px]", profile.color)} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{regua.name}</h3>
          <p className="text-xs text-gray-500 truncate mt-0.5">{regua.description}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {regua.clientCount} {regua.clientCount === 1 ? "cliente" : "clientes"}
            </span>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <span className="text-xs text-gray-500">{regua.steps.length} etapas</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
            role="switch"
            aria-checked={regua.active}
            aria-label={regua.active ? `Desativar ${regua.name}` : `Ativar ${regua.name}`}
            className={cn(
              "relative h-[26px] w-[46px] rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 focus-visible:ring-offset-2",
              regua.active ? "bg-emerald-500" : "bg-gray-200"
            )}
          >
            <span
              className={cn(
                "absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200",
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
                      background: `linear-gradient(to right, #e5e7eb 0%, #e5e7eb ${d0Index >= 0 ? ((d0Index / Math.max(sorted.length - 1, 1)) * 100 - 5) : 50}%, var(--menlo-orange) ${d0Index >= 0 ? (d0Index / Math.max(sorted.length - 1, 1)) * 100 : 50}%, #fcd34d ${d0Index >= 0 ? ((d0Index / Math.max(sorted.length - 1, 1)) * 100 + 5) : 50}%, #fcd34d 100%)`,
                      animation: "regua-track-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both",
                      transformOrigin: "left center",
                    }}
                  />
                </div>
              </div>

              {/* Nodes */}
              <div className="relative flex items-start">
                {sorted.map((step, i) => {
                  const ChannelIcon = CHANNEL_META[step.channel].icon;
                  const channelLabel = CHANNEL_META[step.channel].label;
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
