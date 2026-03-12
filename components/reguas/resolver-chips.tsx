"use client";

interface ResolverChipProps {
  icon: string;
  mode: string;
  label: string;
  lift?: number | null;
  liftLabel?: string;
}

export function ResolverChip({
  icon,
  mode,
  label,
  lift,
  liftLabel,
}: ResolverChipProps) {
  const isManual = mode === "MANUAL";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium ${
        isManual
          ? "bg-gray-50 text-gray-400 border border-gray-100"
          : "bg-purple-50 text-purple-700 border border-purple-200"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isManual ? "bg-gray-300" : "bg-purple-500"}`}
      />
      <span>{icon}</span>
      <span>{label}</span>
      {lift != null && lift > 0 && (
        <span className="text-[9px] font-semibold text-emerald-500">
          +{Math.round(lift * 100)}% {liftLabel}
        </span>
      )}
    </span>
  );
}

interface ResolverChipRowProps {
  step: {
    timingMode: string;
    channelMode: string;
    contentMode: string;
    fallbackTime?: string | null;
    channel: string;
    resolverStats?: {
      bestHourStart?: string | null;
      timingLift?: number | null;
      bestChannel?: string | null;
      channelLift?: number | null;
      winnerVariantId?: string | null;
      contentLift?: number | null;
    } | null;
    variants?: { label: string; active: boolean }[];
  };
}

export function ResolverChipRow({ step }: ResolverChipRowProps) {
  const stats = step.resolverStats;

  const timingLabel =
    step.timingMode === "SMART" && stats?.bestHourStart
      ? stats.bestHourStart
      : step.fallbackTime || "10:00";

  const channelLabel =
    step.channelMode === "SMART" && stats?.bestChannel
      ? stats.bestChannel
      : step.channel;

  const activeVariants = step.variants?.filter((v) => v.active).length || 0;
  const contentLabel =
    step.contentMode === "SMART" && activeVariants > 0
      ? `${activeVariants} variante${activeVariants > 1 ? "s" : ""}`
      : "1 template";

  return (
    <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-gray-100 flex-wrap">
      <ResolverChip
        icon="clock"
        mode={step.timingMode}
        label={step.timingMode === "SMART" ? "Melhor horario" : timingLabel}
        lift={stats?.timingLift}
        liftLabel="abert."
      />
      <ResolverChip
        icon="smartphone"
        mode={step.channelMode}
        label={step.channelMode === "SMART" ? "Melhor canal" : channelLabel}
        lift={stats?.channelLift}
        liftLabel="resp."
      />
      <ResolverChip
        icon="edit"
        mode={step.contentMode}
        label={contentLabel}
        lift={stats?.contentLift}
        liftLabel="conv."
      />
    </div>
  );
}
