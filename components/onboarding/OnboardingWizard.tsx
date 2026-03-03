"use client";

import { useState, useCallback } from "react";
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
  Receipt,
  Bell,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  Mail,
  MessageSquare,
} from "lucide-react";
import { ImportDialog } from "@/components/franqueados/ImportDialog";
import { ImportChargesDialog } from "@/components/cobrancas/ImportChargesDialog";
import type { Franqueado } from "@/lib/types";

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
  empresaNome?: string;
}

const STEPS = [
  { id: 1, name: "Bem-vindo" },
  { id: 2, name: "Cadastro" },
  { id: 3, name: "Cobranças" },
  { id: 4, name: "Régua" },
  { id: 5, name: "Pronto!" },
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
  const [clientImportOpen, setClientImportOpen] = useState(false);
  const [chargesImportOpen, setChargesImportOpen] = useState(false);
  const [importedClients, setImportedClients] = useState(0);
  const [importedCharges, setImportedCharges] = useState(0);
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

  const handleClientImport = useCallback((rows: Franqueado[]) => {
    setImportedClients((prev) => prev + rows.length);
  }, []);

  const handleChargesImportComplete = useCallback(() => {
    setImportedCharges((prev) => prev + 1);
  }, []);

  return (
    <>
      <Dialog open={open && !clientImportOpen && !chargesImportOpen} onOpenChange={(isOpen) => { if (!isOpen) handleComplete(); }}>
        <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden">
          {/* Stepper header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <Stepper steps={STEPS} currentStep={step} />
          </div>

          {/* Content area */}
          <div className="px-6 py-6 min-h-[280px] flex flex-col">
            {step === 1 && <StepWelcome empresaNome={empresaNome} />}
            {step === 2 && (
              <StepClients
                onOpenImport={() => setClientImportOpen(true)}
                importedCount={importedClients}
              />
            )}
            {step === 3 && (
              <StepCharges
                onOpenImport={() => setChargesImportOpen(true)}
                importedCount={importedCharges}
              />
            )}
            {step === 4 && <StepRegua />}
            {step === 5 && <StepReady />}
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

            {step < 5 ? (
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
                  onClick={() => handleCompleteAndNavigate("/clientes")}
                  disabled={completing}
                  className="px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  Ver cadastro
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

      {/* Import dialogs rendered outside the onboarding dialog */}
      <ImportDialog
        open={clientImportOpen}
        onOpenChange={setClientImportOpen}
        existingFranqueados={[]}
        onImport={handleClientImport}
      />

      <ImportChargesDialog
        open={chargesImportOpen}
        onOpenChange={setChargesImportOpen}
        onImportComplete={handleChargesImportComplete}
      />
    </>
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

function StepClients({ onOpenImport, importedCount }: { onOpenImport: () => void; importedCount: number }) {
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
          onClick={onOpenImport}
          className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10 transition-all text-left group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors">
            <Upload className="h-4 w-4 text-primary transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Importar planilha</p>
            <p className="text-xs text-gray-500">Importe vários clientes de uma vez (.xlsx, .csv)</p>
          </div>
          <ArrowRight className="h-4 w-4 text-primary/40 group-hover:text-primary transition-colors" />
        </button>

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
      </div>

      {importedCount > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          {importedCount} cliente{importedCount !== 1 ? "s" : ""} importado{importedCount !== 1 ? "s" : ""}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-auto pt-4">
        Você pode pular esta etapa e cadastrar clientes depois.
      </p>
    </div>
  );
}

function StepCharges({ onOpenImport, importedCount }: { onOpenImport: () => void; importedCount: number }) {
  const router = useRouter();
  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
          <Receipt className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Importe suas cobranças</h3>
          <p className="text-sm text-gray-500">Suba os dados financeiros dos seus franqueados</p>
        </div>
      </div>

      <div className="space-y-3 mt-2">
        <button
          onClick={onOpenImport}
          className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10 transition-all text-left group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors">
            <Upload className="h-4 w-4 text-primary transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Importar cobranças</p>
            <p className="text-xs text-gray-500">Importe de uma planilha (.xlsx, .csv)</p>
          </div>
          <ArrowRight className="h-4 w-4 text-primary/40 group-hover:text-primary transition-colors" />
        </button>

        <button
          onClick={() => router.push("/cobrancas/nova")}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 group-hover:bg-primary/10 transition-colors">
            <Receipt className="h-4 w-4 text-gray-600 group-hover:text-primary transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Criar manualmente</p>
            <p className="text-xs text-gray-500">Crie cobranças uma a uma</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors" />
        </button>
      </div>

      {importedCount > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          Cobranças importadas com sucesso
        </div>
      )}

      <p className="text-xs text-gray-400 mt-auto pt-4">
        Você pode pular esta etapa e criar cobranças depois.
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
          <h3 className="text-base font-semibold text-gray-900">Régua Padrão criada</h3>
          <p className="text-sm text-gray-500">Já configuramos uma régua automática para você</p>
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
        Você pode personalizar esta régua a qualquer momento em{" "}
        <span className="font-medium text-gray-500">Réguas de Cobrança</span>.
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
        Sua conta está configurada. Agora você pode acompanhar tudo pelo
        dashboard e perguntar o que quiser para a Júlia.
      </p>
    </div>
  );
}
