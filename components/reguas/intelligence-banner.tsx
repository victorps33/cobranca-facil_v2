"use client";

import Link from "next/link";

interface IntelligenceBannerProps {
  ruleId: string;
  smartStepCount: number;
  totalStepCount: number;
  recoveryLift?: number;
  costReduction?: number;
  speedDays?: number;
}

export function IntelligenceBanner({
  ruleId,
  smartStepCount,
  totalStepCount,
  recoveryLift,
  costReduction,
  speedDays,
}: IntelligenceBannerProps) {
  if (smartStepCount === 0) return null;

  return (
    <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200 rounded-2xl p-4 mb-5 flex items-center gap-4">
      <div className="w-9 h-9 bg-purple-500 rounded-lg flex items-center justify-center text-lg shrink-0">
        <span className="text-white text-sm font-bold">IA</span>
      </div>
      <div className="flex-1">
        <h4 className="text-[13px] font-semibold text-purple-600">
          Inteligencia Ativa
        </h4>
        <p className="text-[11px] text-gray-500">
          {smartStepCount} de {totalStepCount} steps no modo inteligente
        </p>
      </div>
      <div className="flex gap-5">
        {recoveryLift != null && (
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">
              +{Math.round(recoveryLift * 100)}%
            </div>
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">
              Recuperacao
            </div>
          </div>
        )}
        {costReduction != null && (
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">
              -{Math.round(costReduction * 100)}%
            </div>
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">
              Custo/msg
            </div>
          </div>
        )}
        {speedDays != null && (
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">
              {speedDays}d
            </div>
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">
              Mais rapido
            </div>
          </div>
        )}
      </div>
      <Link
        href={`/reguas/${ruleId}/intelligence`}
        className="text-purple-600 text-xs font-semibold hover:text-purple-700"
      >
        Ver detalhes →
      </Link>
    </div>
  );
}
