"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/cn";
import {
  Rocket,
  Users,
  Bell,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Mail,
  MessageSquare,
} from "lucide-react";

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
  empresaNome?: string;
}

const STEPS = [
  { id: 1, name: "Bem-vindo" },
  { id: 2, name: "Clientes" },
  { id: 3, name: "Régua" },
  { id: 4, name: "Pronto!" },
];

const TIMELINE_STEPS = [
  { offset: "D-5", channel: "Email", icon: Mail, description: "Lembrete de vencimento" },
  { offset: "D-1", channel: "WhatsApp", icon: MessageSquare, description: "Aviso véspera" },
  { offset: "D+3", channel: "SMS", icon: MessageSquare, description: "Cobrança vencida" },
  { offset: "D+7", channel: "WhatsApp", icon: MessageSquare, description: "Último aviso" },
];

export function OnboardingWizard({ open, onComplete, empresaNome }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [completing, setCompleting] = useState(false);
  const router = useRouter();

  async function handleComplete() {
    setCompleting(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
      onComplete();
    } finally {
      setCompleting(false);
    }
  }

  async function handleCompleteAndNavigate(href: string) {
    setCompleting(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
      onComplete();
      router.push(href);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleComplete(); }}>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden">
        {/* Stepper header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <Stepper steps={STEPS} currentStep={step} />
        </div>

        {/* Content area */}
        <div className="px-6 py-6 min-h-[280px] flex flex-col">
          {step === 1 && (
            <StepWelcome empresaNome={empresaNome} />
          )}
          {step === 2 && <StepClients />}
          {step === 3 && <StepRegua />}
          {step === 4 && <StepReady />}
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
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              Continuar
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCompleteAndNavigate("/clientes/novo")}
                disabled={completing}
                className="px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              >
                Cadastrar cliente
              </button>
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                Ir para o Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Step Contents ── */

function StepWelcome({ empresaNome }: { empresaNome?: string }) {
  return (
    <div className="flex flex-col items-center text-center flex-1 justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
        <Rocket className="h-8 w-8 text-primary" />
      </div>
      <DialogHeader className="items-center">
        <DialogTitle className="text-xl">
          Bem-vindo à Menlo{empresaNome ? `, ${empresaNome}` : ""}!
        </DialogTitle>
        <DialogDescription className="text-sm text-gray-500 mt-2 max-w-sm">
          A Menlo vai ajudar você a gerenciar cobranças da sua rede de forma
          inteligente e automatizada. Vamos configurar tudo em poucos passos.
        </DialogDescription>
      </DialogHeader>
    </div>
  );
}

function StepClients() {
  const router = useRouter();
  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Users className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Cadastre seus clientes</h3>
          <p className="text-sm text-gray-500">Comece adicionando os dados de quem você cobra</p>
        </div>
      </div>

      <div className="space-y-3 mt-2">
        <button
          onClick={() => router.push("/clientes/novo")}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 group-hover:bg-primary/10 transition-colors">
            <Users className="h-4 w-4 text-gray-600 group-hover:text-primary transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Cadastrar manualmente</p>
            <p className="text-xs text-gray-500">Adicione clientes um a um</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors" />
        </button>

        <button
          onClick={() => router.push("/clientes/novo")}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 group-hover:bg-primary/10 transition-colors">
            <Users className="h-4 w-4 text-gray-600 group-hover:text-primary transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Importar planilha</p>
            <p className="text-xs text-gray-500">Importe v&aacute;rios clientes de uma vez</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors" />
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-auto pt-4">
        Voc&ecirc; pode pular esta etapa e cadastrar clientes depois.
      </p>
    </div>
  );
}

function StepRegua() {
  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
          <Bell className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">R&eacute;gua Padr&atilde;o criada</h3>
          <p className="text-sm text-gray-500">J&aacute; configuramos uma r&eacute;gua autom&aacute;tica para voc&ecirc;</p>
        </div>
      </div>

      {/* Mini timeline */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        {TIMELINE_STEPS.map((s, i) => {
          const Icon = s.icon;
          const isAfter = s.offset.startsWith("D+");
          return (
            <div key={i} className="flex items-center gap-3">
              <span className={cn(
                "text-xs font-mono font-semibold w-10 text-right",
                isAfter ? "text-amber-600" : "text-gray-600"
              )}>
                {s.offset}
              </span>
              <div className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                isAfter ? "bg-amber-100" : "bg-gray-200"
              )}>
                <Icon className={cn("h-3.5 w-3.5", isAfter ? "text-amber-700" : "text-gray-600")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{s.description}</p>
                <p className="text-xs text-gray-400">{s.channel}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-auto pt-3">
        Voc&ecirc; pode personalizar esta r&eacute;gua a qualquer momento em{" "}
        <span className="font-medium text-gray-500">R&eacute;guas de Cobran&ccedil;a</span>.
      </p>
    </div>
  );
}

function StepReady() {
  return (
    <div className="flex flex-col items-center text-center flex-1 justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 mb-4">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900">Tudo pronto!</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-sm">
        Sua conta est&aacute; configurada. Agora voc&ecirc; pode cadastrar clientes,
        criar cobran&ccedil;as e acompanhar tudo pelo dashboard.
      </p>
    </div>
  );
}
