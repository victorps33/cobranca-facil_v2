"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/cn";
import {
  Sparkles,
  Shield,
  Lock,
  CheckCircle2,
  Target,
  TrendingDown,
  BarChart3,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

interface JuliaOnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

const STEPS = [
  { id: 1, name: "Conheça" },
  { id: 2, name: "Como funciona" },
  { id: 3, name: "Privacidade" },
  { id: 4, name: "Comece!" },
];

const EXAMPLE_QUESTIONS = [
  { label: "Quem cobrar primeiro?", icon: Target, color: "text-red-500", bgColor: "bg-red-50" },
  { label: "O que mudou este mês?", icon: TrendingDown, color: "text-amber-500", bgColor: "bg-amber-50" },
  { label: "Comparar regiões", icon: BarChart3, color: "text-blue-500", bgColor: "bg-blue-50" },
];

const QUICK_PRESETS = [
  { id: "prioridade", label: "Quem cobrar primeiro?", question: "Quem eu devo cobrar primeiro? Analise por urgência e valor.", icon: Target, color: "text-red-500", bgColor: "bg-red-50" },
  { id: "mudancas", label: "O que mudou este mês?", question: "O que mudou na minha rede este mês? Liste melhorias e pioras.", icon: TrendingDown, color: "text-amber-500", bgColor: "bg-amber-50" },
  { id: "comparar", label: "Comparar regiões", question: "Compare a inadimplência e recuperação por região da minha rede.", icon: BarChart3, color: "text-blue-500", bgColor: "bg-blue-50" },
  { id: "previsao", label: "Previsão de recebimento", question: "Qual a previsão de recebimento para os próximos 30 dias?", icon: Lightbulb, color: "text-emerald-500", bgColor: "bg-emerald-50" },
];

export function JuliaOnboardingWizard({ open, onComplete }: JuliaOnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [consentChecked, setConsentChecked] = useState(false);

  function handleComplete() {
    localStorage.setItem("julia_onboarding_done", "true");
    onComplete();
  }

  const canProceed = step !== 3 || consentChecked;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleComplete(); }}>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden">
        {/* Stepper header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <Stepper steps={STEPS} currentStep={step} />
        </div>

        {/* Content area */}
        <div className="px-6 py-6 min-h-[320px] flex flex-col">
          {step === 1 && <StepIntro />}
          {step === 2 && <StepHowItWorks />}
          {step === 3 && (
            <StepPrivacy
              consentChecked={consentChecked}
              onConsentChange={setConsentChecked}
            />
          )}
          {step === 4 && <StepGetStarted onSelect={handleComplete} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuar
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Explorar Júlia
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Step 1: O que é a Júlia? ── */

function StepIntro() {
  return (
    <div className="flex flex-col items-center text-center flex-1 justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mb-4">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900">Conheça a Júlia</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-sm">
        Sua analista de dados com inteligência artificial. A Júlia transforma os dados da sua rede em insights acionáveis.
      </p>

      <div className="mt-6 w-full max-w-sm space-y-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Exemplos do que ela pode fazer</p>
        {EXAMPLE_QUESTIONS.map((q) => {
          const Icon = q.icon;
          return (
            <div
              key={q.label}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50"
            >
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", q.bgColor)}>
                <Icon className={cn("h-4 w-4", q.color)} />
              </div>
              <span className="text-sm text-gray-700 font-medium">{q.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 2: Como funciona? ── */

function StepHowItWorks() {
  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Shield className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Como a Júlia funciona</h3>
          <p className="text-sm text-gray-500">Inteligência artificial aplicada aos seus dados</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Analisa seus dados de cobrança</p>
            <p className="text-xs text-gray-500 mt-0.5">A Júlia lê os dados agregados da sua rede para gerar insights relevantes.</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <Lock className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Processamento seguro</p>
            <p className="text-xs text-gray-500 mt-0.5">Dados são anonimizados antes do processamento. Nenhuma informação pessoal é compartilhada.</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
            <Sparkles className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Powered by Anthropic</p>
            <p className="text-xs text-gray-500 mt-0.5">Usa tecnologia de IA de última geração para respostas precisas e confiáveis.</p>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-4 flex items-center gap-4">
        <a
          href="https://www.anthropic.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          Sobre a Anthropic <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href="https://www.anthropic.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          Política de privacidade <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

/* ── Step 3: Privacidade e Consentimento ── */

function StepPrivacy({
  consentChecked,
  onConsentChange,
}: {
  consentChecked: boolean;
  onConsentChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
          <Lock className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Privacidade e Consentimento</h3>
          <p className="text-sm text-gray-500">Seus dados estão protegidos</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700">Dados financeiros são processados de forma <strong>agregada e anônima</strong></p>
        </div>
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700">CPFs, CNPJs, emails e telefones são <strong>removidos</strong> antes do processamento</p>
        </div>
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700">Nenhum dado é armazenado pela IA — apenas <strong>análises em tempo real</strong></p>
        </div>
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700">Você pode <strong>desativar a Júlia</strong> a qualquer momento em Configurações</p>
        </div>
      </div>

      <div className="mt-auto pt-6">
        <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:border-blue-200 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20"
          />
          <span className="text-sm text-gray-700">
            Li e concordo com o uso de inteligência artificial para analisar dados agregados da minha rede de forma segura e anônima.
          </span>
        </label>
      </div>
    </div>
  );
}

/* ── Step 4: Comece agora ── */

function StepGetStarted({ onSelect }: { onSelect: () => void }) {
  return (
    <div className="flex flex-col items-center text-center flex-1 justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 mb-4">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900">Tudo pronto!</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-sm">
        Escolha uma pergunta para começar ou explore livremente.
      </p>

      <div className="mt-6 w-full max-w-sm grid grid-cols-2 gap-2">
        {QUICK_PRESETS.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.id}
              onClick={onSelect}
              className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left group"
            >
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", preset.bgColor)}>
                <Icon className={cn("h-4 w-4", preset.color)} />
              </div>
              <span className="text-[11px] font-medium text-gray-700 group-hover:text-blue-700 line-clamp-2">
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
