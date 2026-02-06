"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/ui/stepper";
import { StatCard } from "@/components/layout/StatCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Upload,
  Wifi,
  WifiOff,
  Users,
  DollarSign,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Circle,
  PartyPopper,
  Calendar,
} from "lucide-react";
import {
  type ApuracaoFranqueado,
  type RegraApuracao,
  type ResultadoFranqueado,
  type FonteDados,
  fontesDummy,
  franqueadosDummy,
  regrasDefault,
  calcularApuracao,
  getCompetenciaAtual,
  getDiasParaEmissao,
} from "@/lib/data/apuracao-dummy";

// ============================================
// LOCAL HELPERS (avoid importing server-side lib/utils)
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

// ============================================
// STEPS CONFIG
// ============================================

const STEPS = [
  { id: 1, name: "Dados" },
  { id: 2, name: "Regras" },
  { id: 3, name: "Calculando" },
  { id: 4, name: "Revisar" },
  { id: 5, name: "Aprovar" },
  { id: 6, name: "Emitir" },
];

// ============================================
// MAIN WIZARD
// ============================================

export function ApuracaoWizard() {
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [fontes] = useState<FonteDados[]>(fontesDummy);
  const [franqueados] = useState<ApuracaoFranqueado[]>(franqueadosDummy);
  const [regras, setRegras] = useState<RegraApuracao>({ ...regrasDefault });
  const [resultados, setResultados] = useState<ResultadoFranqueado[]>([]);
  const [aprovacao, setAprovacao] = useState({ revisou: false, verificou: false, confirmou: false });
  const [emissao, setEmissao] = useState({
    vencimento: getDefaultVencimento(),
    boleto: true,
    pix: true,
    emailNotif: true,
    whatsappNotif: true,
  });
  const [emitido, setEmitido] = useState(false);
  const [emitindo, setEmitindo] = useState(false);

  // Step 2 — collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    royalty: true,
    marketing: false,
    excecoes: false,
    descontos: false,
  });

  // Step 3 — checkpoints
  const [checkpoints, setCheckpoints] = useState<number>(0);

  // ── Helpers ──

  function getDefaultVencimento(): string {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  }

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const subtitleForStep = (step: number): string => {
    switch (step) {
      case 1: return "Coleta de dados dos franqueados";
      case 2: return "Configure as regras de apuração";
      case 3: return "Processando cálculos...";
      case 4: return "Revise os valores calculados";
      case 5: return "Aprove a apuração do ciclo";
      case 6: return emitido ? "Ciclo concluído" : "Emita as cobranças";
      default: return "";
    }
  };

  // ── Navigation ──

  const handleNext = () => {
    if (currentStep === 2) {
      // Go to calculating step
      setCurrentStep(3);
      return;
    }
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 4) {
      // Skip step 3 (calculating) when going back
      setCurrentStep(2);
      return;
    }
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (step: number) => {
    // Only allow clicking completed steps (but skip step 3)
    if (step < currentStep && step !== 3) {
      setCurrentStep(step);
    }
  };

  // ── Step 3: Calculating animation ──

  useEffect(() => {
    if (currentStep !== 3) return;

    setCheckpoints(0);
    const delays = [600, 1200, 1800, 2400, 3000];
    const timers: NodeJS.Timeout[] = [];

    delays.forEach((delay, i) => {
      timers.push(
        setTimeout(() => {
          setCheckpoints(i + 1);
        }, delay)
      );
    });

    // Auto-advance after all checkpoints
    timers.push(
      setTimeout(() => {
        const results = calcularApuracao(franqueados, regras);
        setResultados(results);
        setCurrentStep(4);
      }, 3500)
    );

    return () => timers.forEach(clearTimeout);
  }, [currentStep, franqueados, regras]);

  // ── Step 6: Emit ──

  const handleEmitir = async () => {
    setEmitindo(true);
    try {
      // Create charges via API for each franqueado
      for (const r of resultados) {
        await fetch("/api/charges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: r.id,
            description: `Apuração ${getCompetenciaAtual()} — ${r.nome}`,
            amountCents: r.totalCobrar,
            dueDate: emissao.vencimento,
          }),
        });
      }

      setEmitido(true);
      toast({
        title: "Cobranças emitidas!",
        description: `${resultados.length} cobranças foram geradas com sucesso.`,
      });
    } catch {
      toast({
        title: "Erro ao emitir cobranças",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setEmitindo(false);
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setRegras({ ...regrasDefault });
    setResultados([]);
    setAprovacao({ revisou: false, verificou: false, confirmou: false });
    setEmissao({
      vencimento: getDefaultVencimento(),
      boleto: true,
      pix: true,
      emailNotif: true,
      whatsappNotif: true,
    });
    setEmitido(false);
    setEmitindo(false);
    setCheckpoints(0);
  };

  // ── Derived data ──

  const totalFaturamento = resultados.reduce((s, r) => s + r.faturamento, 0);
  const totalCobrar = resultados.reduce((s, r) => s + r.totalCobrar, 0);
  const franqueadosComAlerta = resultados.filter((r) => r.flagRevisao).length;
  const canAprovar = aprovacao.revisou && aprovacao.verificou && aprovacao.confirmou;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <Stepper
          steps={STEPS}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Step subtitle */}
      <p className="text-sm text-gray-500">{subtitleForStep(currentStep)}</p>

      {/* ════════════════════════════════════════════ */}
      {/* STEP 1 — DADOS                              */}
      {/* ════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Header info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Cafe & Cia &middot; {franqueados.length} franqueados ativos
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {getCompetenciaAtual()} &middot; {getDiasParaEmissao()} dias para emissao
                </p>
              </div>
            </div>
          </div>

          {/* Fontes conectadas */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Fontes conectadas</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {fontes.map((fonte) => (
                <div
                  key={fonte.id}
                  className={cn(
                    "bg-white rounded-2xl border p-4 flex items-center gap-3",
                    fonte.conectado ? "border-gray-100" : "border-dashed border-gray-200"
                  )}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-xl flex items-center justify-center",
                    fonte.conectado ? "bg-emerald-50" : "bg-gray-50"
                  )}>
                    {fonte.conectado ? (
                      <Wifi className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{fonte.nome}</p>
                    <p className="text-xs text-gray-400">
                      {fonte.conectado
                        ? `${fonte.unidades} unidades`
                        : "Desconectado"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Import manual */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Import manual</h3>
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center hover:border-gray-300 transition-colors cursor-pointer">
              <Upload className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">
                Arraste um arquivo CSV ou Excel aqui
              </p>
              <p className="text-xs text-gray-400 mt-1">
                ou clique para selecionar
              </p>
            </div>
          </div>

          {/* Tabela de dados */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-900">Dados coletados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Dados de faturamento por franqueado">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-5 py-3 font-medium text-gray-500">Franqueado</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">PDV</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">iFood</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Total</th>
                    <th className="px-5 py-3 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {franqueados.map((f) => (
                    <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">{f.nome}</td>
                      <td className="px-5 py-3 text-right text-gray-600 tabular-nums">{formatCurrency(f.pdv)}</td>
                      <td className="px-5 py-3 text-right text-gray-600 tabular-nums">{formatCurrency(f.ifood)}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900 tabular-nums">{formatCurrency(f.total)}</td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-full",
                          f.status === "ok"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        )}>
                          {f.status === "ok" ? "OK" : "Alerta"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              {franqueados.length} franqueados
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* STEP 2 — REGRAS                             */}
      {/* ════════════════════════════════════════════ */}
      {currentStep === 2 && (
        <div className="space-y-4">
          {/* Royalty */}
          <CollapsibleSection
            title="Royalty"
            open={openSections.royalty}
            onToggle={() => toggleSection("royalty")}
          >
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Percentual de royalty</Label>
                <div className="relative mt-2 max-w-xs">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={regras.royaltyPercent}
                    onChange={(e) => setRegras((prev) => ({ ...prev, royaltyPercent: parseFloat(e.target.value) || 0 }))}
                    className="h-11 pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Base de calculo</Label>
                <div className="flex gap-2 mt-2">
                  {(["bruto", "liquido"] as const).map((base) => (
                    <button
                      key={base}
                      onClick={() => setRegras((prev) => ({ ...prev, baseCalculo: base }))}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                        regras.baseCalculo === base
                          ? "bg-[#85ace6] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {base === "bruto" ? "Faturamento Bruto" : "Faturamento Liquido"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Taxa Marketing */}
          <CollapsibleSection
            title="Taxa de Marketing"
            open={openSections.marketing}
            onToggle={() => toggleSection("marketing")}
          >
            <div>
              <Label className="text-sm font-medium text-gray-700">Percentual de marketing</Label>
              <div className="relative mt-2 max-w-xs">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={regras.marketingPercent}
                  onChange={(e) => setRegras((prev) => ({ ...prev, marketingPercent: parseFloat(e.target.value) || 0 }))}
                  className="h-11 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
              </div>
            </div>
          </CollapsibleSection>

          {/* Excecoes */}
          <CollapsibleSection
            title="Excecoes"
            open={openSections.excecoes}
            onToggle={() => toggleSection("excecoes")}
          >
            <p className="text-sm text-gray-400">Nenhuma excecao configurada</p>
          </CollapsibleSection>

          {/* Descontos */}
          <CollapsibleSection
            title="Descontos"
            open={openSections.descontos}
            onToggle={() => toggleSection("descontos")}
          >
            <p className="text-sm text-gray-400">Nenhum desconto neste ciclo</p>
          </CollapsibleSection>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* STEP 3 — CALCULANDO                         */}
      {/* ════════════════════════════════════════════ */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-10 w-10 text-[#85ace6] animate-spin mb-6" />
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Processando apuracao</h2>

            <div className="space-y-4 w-full max-w-md">
              {[
                "Validando dados de entrada",
                "Aplicando regras de negocio",
                "Calculando valores por franqueado",
                "Gerando memoria de calculo",
                "Verificando inconsistencias",
              ].map((label, i) => (
                <div key={i} className="flex items-center gap-3">
                  {checkpoints > i ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  ) : checkpoints === i ? (
                    <Loader2 className="h-5 w-5 text-[#85ace6] animate-spin flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-200 flex-shrink-0" />
                  )}
                  <span className={cn(
                    "text-sm",
                    checkpoints > i ? "text-gray-900" : checkpoints === i ? "text-[#85ace6]" : "text-gray-400"
                  )}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* STEP 4 — REVISAR                            */}
      {/* ════════════════════════════════════════════ */}
      {currentStep === 4 && (
        <div className="space-y-6">
          {/* Metricas resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={<Users className="h-4 w-4 text-gray-400" />}
              label="Franqueados"
              value={String(resultados.length)}
              caption="ativos neste ciclo"
            />
            <StatCard
              icon={<DollarSign className="h-4 w-4 text-gray-400" />}
              label="Faturamento total"
              value={formatCurrency(totalFaturamento)}
              caption={getCompetenciaAtual()}
            />
            <StatCard
              icon={<Calculator className="h-4 w-4 text-gray-400" />}
              label="A cobrar"
              value={formatCurrency(totalCobrar)}
              caption={`royalty ${regras.royaltyPercent}% + mkt ${regras.marketingPercent}%`}
            />
          </div>

          {/* Alerta de variacao */}
          {franqueadosComAlerta > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <strong>{franqueadosComAlerta} franqueado{franqueadosComAlerta > 1 ? "s" : ""}</strong> com variacao acima de 20% em relacao ao mes anterior.
              </p>
            </div>
          )}

          {/* Tabela detalhada */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Resultado da apuracao">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-5 py-3 font-medium text-gray-500">Franqueado</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Faturamento</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Royalty</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Marketing</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Total</th>
                    <th className="px-5 py-3 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r) => (
                    <tr
                      key={r.id}
                      className={cn(
                        "border-b border-gray-50 transition-colors",
                        r.flagRevisao ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-gray-50/50"
                      )}
                    >
                      <td className="px-5 py-3 font-medium text-gray-900">{r.nome}</td>
                      <td className="px-5 py-3 text-right text-gray-600 tabular-nums">{formatCurrency(r.faturamento)}</td>
                      <td className="px-5 py-3 text-right text-gray-600 tabular-nums">{formatCurrency(r.royalty)}</td>
                      <td className="px-5 py-3 text-right text-gray-600 tabular-nums">{formatCurrency(r.marketing)}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900 tabular-nums">{formatCurrency(r.totalCobrar)}</td>
                      <td className="px-5 py-3">
                        {r.flagRevisao ? (
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                            {r.variacao > 0 ? "+" : ""}{r.variacao}%
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* STEP 5 — APROVAR                            */}
      {/* ════════════════════════════════════════════ */}
      {currentStep === 5 && (
        <div className="space-y-6">
          {/* Metricas (same as step 4) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={<Users className="h-4 w-4 text-gray-400" />}
              label="Franqueados"
              value={String(resultados.length)}
              caption="ativos neste ciclo"
            />
            <StatCard
              icon={<DollarSign className="h-4 w-4 text-gray-400" />}
              label="Faturamento total"
              value={formatCurrency(totalFaturamento)}
              caption={getCompetenciaAtual()}
            />
            <StatCard
              icon={<Calculator className="h-4 w-4 text-gray-400" />}
              label="A cobrar"
              value={formatCurrency(totalCobrar)}
              caption={`royalty ${regras.royaltyPercent}% + mkt ${regras.marketingPercent}%`}
            />
          </div>

          {/* Checkboxes */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Confirmacao de aprovacao</h3>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aprovacao.revisou}
                onChange={(e) => setAprovacao((prev) => ({ ...prev, revisou: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#F85B00] focus:ring-[#F85B00]"
              />
              <span className="text-sm text-gray-700">Revisei os valores por franqueado</span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aprovacao.verificou}
                onChange={(e) => setAprovacao((prev) => ({ ...prev, verificou: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#F85B00] focus:ring-[#F85B00]"
              />
              <span className="text-sm text-gray-700">Verifiquei as divergencias sinalizadas</span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aprovacao.confirmou}
                onChange={(e) => setAprovacao((prev) => ({ ...prev, confirmou: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#F85B00] focus:ring-[#F85B00]"
              />
              <span className="text-sm text-gray-700">Confirmo que os dados estao corretos</span>
            </label>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* STEP 6 — EMITIR                             */}
      {/* ════════════════════════════════════════════ */}
      {currentStep === 6 && !emitido && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
            {/* Resumo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Total a cobrar</p>
                <p className="text-xl font-bold text-gray-900 tabular-nums mt-1">{formatCurrency(totalCobrar)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Franqueados</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{resultados.length}</p>
              </div>
            </div>

            {/* Vencimento */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Vencimento</Label>
              <div className="relative mt-2 max-w-xs">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={emissao.vencimento}
                  onChange={(e) => setEmissao((prev) => ({ ...prev, vencimento: e.target.value }))}
                  className="pl-10 h-11"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Alterar o vencimento pode impactar a regua de cobranca
              </p>
            </div>

            {/* Meios de pagamento */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Meios de pagamento</p>
              <div className="flex gap-2">
                <TogglePill
                  label="Boleto"
                  active={emissao.boleto}
                  onToggle={() => setEmissao((prev) => ({ ...prev, boleto: !prev.boleto }))}
                />
                <TogglePill
                  label="Pix"
                  active={emissao.pix}
                  onToggle={() => setEmissao((prev) => ({ ...prev, pix: !prev.pix }))}
                />
              </div>
            </div>

            {/* Notificacao */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Notificacao</p>
              <div className="flex gap-2">
                <TogglePill
                  label="Email"
                  active={emissao.emailNotif}
                  onToggle={() => setEmissao((prev) => ({ ...prev, emailNotif: !prev.emailNotif }))}
                />
                <TogglePill
                  label="WhatsApp"
                  active={emissao.whatsappNotif}
                  onToggle={() => setEmissao((prev) => ({ ...prev, whatsappNotif: !prev.whatsappNotif }))}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estado de sucesso pos-emissao */}
      {currentStep === 6 && emitido && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
              <PartyPopper className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Ciclo concluido!</h2>
            <p className="text-sm text-gray-500 mb-8">Todas as cobrancas foram emitidas com sucesso.</p>

            <div className="grid grid-cols-3 gap-6 mb-8 w-full max-w-md">
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{resultados.length}</p>
                <p className="text-xs text-gray-500 mt-1">cobrancas emitidas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatCurrency(totalCobrar)}</p>
                <p className="text-xs text-gray-500 mt-1">valor total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">
                  {new Date(emissao.vencimento).toLocaleDateString("pt-BR")}
                </p>
                <p className="text-xs text-gray-500 mt-1">vencimento</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push("/cobrancas")}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
              >
                Ver cobrancas emitidas
              </button>
              <button
                onClick={resetWizard}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#F85B00] rounded-full hover:bg-[#e05200] transition-colors"
              >
                Iniciar proximo ciclo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* FOOTER NAVIGATION                           */}
      {/* ════════════════════════════════════════════ */}
      {currentStep !== 3 && !(currentStep === 6 && emitido) && (
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-colors",
              currentStep === 1
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            {currentStep === 4 ? "Voltar para Regras" : "Voltar"}
          </button>

          {/* Step-specific CTA */}
          {currentStep === 1 && (
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F85B00] text-white rounded-full font-medium hover:bg-[#e05200] transition-colors"
            >
              Continuar para Regras
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {currentStep === 2 && (
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F85B00] text-white rounded-full font-medium hover:bg-[#e05200] transition-colors"
            >
              Calcular apuracao
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {currentStep === 4 && (
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F85B00] text-white rounded-full font-medium hover:bg-[#e05200] transition-colors"
            >
              Tudo certo, aprovar
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {currentStep === 5 && (
            <button
              onClick={handleNext}
              disabled={!canAprovar}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F85B00] text-white rounded-full font-medium hover:bg-[#e05200] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="h-4 w-4" />
              Aprovar
            </button>
          )}

          {currentStep === 6 && !emitido && (
            <button
              onClick={handleEmitir}
              disabled={emitindo}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F85B00] text-white rounded-full font-medium hover:bg-[#e05200] disabled:opacity-50 transition-colors"
            >
              {emitindo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Emitir cobrancas
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {open ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

function TogglePill({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "px-4 py-2 rounded-full text-sm font-medium transition-colors",
        active
          ? "bg-[#85ace6] text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      )}
    >
      {label}
    </button>
  );
}
