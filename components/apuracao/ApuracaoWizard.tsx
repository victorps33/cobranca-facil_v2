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
  Download,
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
  FileText,
  Search,
  X,
  FileSpreadsheet,
  Trash2,
  Sparkles,
  Info,
  Percent,
  Tag,
  Plus,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  parseApuracaoFile,
  type ApuracaoRow,
} from "@/lib/apuracao-upload";
import {
  type ApuracaoFranqueado,
  type RegraApuracao,
  type ResultadoFranqueado,
  type FonteDados,
  type NfConfig,
  type ExcecaoApuracao,
  type DescontoApuracao,
  fontesDummy,
  franqueadosDummy,
  regrasDefault,
  nfConfigDefault,
  calcularApuracao,
} from "@/lib/data/apuracao-dummy";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface ApuracaoWizardProps {
  competencia: string;
}

export function ApuracaoWizard({ competencia }: ApuracaoWizardProps) {
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
  const [nfConfig, setNfConfig] = useState<NfConfig>(nfConfigDefault);

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    rows: ApuracaoRow[];
    warnings: string[];
    summary: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Step 2 — collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    royalty: true,
    marketing: false,
    exceções: false,
    descontos: false,
    notaFiscal: false,
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

  const handleFileUpload = useCallback(async (file: File) => {
    setUploadedFile(file);
    setUploading(true);
    setUploadResult(null);

    try {
      const parsed = await parseApuracaoFile(file);

      if (parsed.rows.length === 0) {
        toast({
          title: "Planilha vazia",
          description: "Nenhum dado encontrado na planilha.",
          variant: "destructive",
        });
        setUploadedFile(null);
        setUploading(false);
        return;
      }

      // Try AI summary, fallback to basic summary if API fails
      let summary: string;
      try {
        const response = await fetch("/api/apuracao/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: parsed.rows,
            headers: parsed.rawHeaders,
          }),
        });

        if (!response.ok) throw new Error("API error");

        const data = await response.json();
        summary = data.summary;
      } catch {
        // Fallback: generate basic summary client-side
        const totalFat = parsed.rows.reduce((s, r) => s + r.total, 0);
        const fmtBRL = (cents: number) =>
          new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
        summary = `Planilha com ${parsed.rows.length} franqueado${parsed.rows.length > 1 ? "s" : ""}. Faturamento total: ${fmtBRL(totalFat)}.`;
        if (parsed.rows.length > 0) {
          const sorted = [...parsed.rows].sort((a, b) => b.total - a.total);
          summary += `\nMaior faturamento: ${sorted[0].nome} (${fmtBRL(sorted[0].total)}).`;
          summary += `\nMenor faturamento: ${sorted[sorted.length - 1].nome} (${fmtBRL(sorted[sorted.length - 1].total)}).`;
        }
      }

      setUploadResult({
        rows: parsed.rows,
        warnings: parsed.warnings,
        summary,
      });

      toast({
        title: "Planilha importada!",
        description: `${parsed.rows.length} franqueados encontrados.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao importar planilha",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
      setUploadedFile(null);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleRemoveUpload = () => {
    setUploadedFile(null);
    setUploadResult(null);
  };

  const subtitleForStep = (step: number): string => {
    switch (step) {
      case 1: return "";
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
        const results = calcularApuracao(franqueados, regras, nfConfig);
        setResultados(results);
        setCurrentStep(4);
      }, 3500)
    );

    return () => timers.forEach(clearTimeout);
  }, [currentStep, franqueados, regras, nfConfig]);

  // ── Step 6: Emit ──

  const nfRoyaltyCount = resultados.filter((r) => r.nfRoyalty).length;
  const nfMarketingCount = resultados.filter((r) => r.nfMarketing).length;
  const totalNfs = nfRoyaltyCount + nfMarketingCount;

  const handleEmitir = async () => {
    setEmitindo(true);
    try {
      // Create separate charges per franqueado (royalties + marketing)
      for (const r of resultados) {
        // Cobrança de Royalties
        await fetch("/api/charges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: r.id,
            description: `Royalties ${competencia} — ${r.nome}`,
            amountCents: r.royalty,
            dueDate: emissao.vencimento,
            categoria: "Royalties",
            nfEmitida: r.nfRoyalty,
          }),
        });

        // Cobrança de Marketing
        await fetch("/api/charges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: r.id,
            description: `Marketing ${competencia} — ${r.nome}`,
            amountCents: r.marketing,
            dueDate: emissao.vencimento,
            categoria: "FNP",
            nfEmitida: r.nfMarketing,
          }),
        });
      }

      setEmitido(true);
      toast({
        title: "Cobranças emitidas!",
        description: `${resultados.length * 2} cobranças foram geradas com sucesso.`,
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
    setNfConfig({ ...nfConfigDefault, exceçõesRoyalty: [], exceçõesMarketing: [] });
    setUploadedFile(null);
    setUploadResult(null);
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
          allCompleted={emitido}
        />
      </div>

      {/* Step subtitle */}
      <p className="text-sm text-gray-500">{subtitleForStep(currentStep)}</p>

      {/* ════════════════════════════════════════════ */}
      {/* STEP 1 — DADOS                              */}
      {/* ════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="space-y-6">
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

          {/* Modelo + Upload */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Baixe o modelo */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-[#FFF0E6] flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Baixe o modelo de dados Menlo</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Planilha .xlsx com as colunas esperadas para importação
                </p>
                <button
                  onClick={() => {
                    const headers = ["Franqueado", "PDV", "iFood", "Rappi"];
                    const exemplo = [
                      ["Franquia Exemplo", 50000, 12000, 3000],
                    ];
                    const ws = XLSX.utils.aoa_to_sheet([headers, ...exemplo]);
                    ws["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Faturamento");
                    XLSX.writeFile(wb, "modelo_menlo_faturamento.xlsx");
                  }}
                  className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 text-xs font-semibold text-primary border border-primary/25 rounded-full hover:bg-primary/5 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar modelo .xlsx
                </button>
              </div>
            </div>

            {/* Upload do faturamento */}
            {uploading && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-5">
                <div className="h-14 w-14 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
                  <Loader2 className="h-7 w-7 text-secondary animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Processando planilha...</p>
                  <p className="text-xs text-gray-400 mt-0.5">Analisando dados com IA</p>
                </div>
              </div>
            )}

            {!uploading && uploadResult && uploadedFile && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                      <p className="text-xs text-gray-400">
                        {uploadResult.rows.length} franqueados encontrados
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveUpload}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-secondary" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Resumo da IA
                    </p>
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {uploadResult.summary}
                  </div>
                </div>
                {uploadResult.warnings.length > 0 && (
                  <div className="px-5 py-3 border-t border-gray-100 bg-amber-50/50">
                    <p className="text-xs font-medium text-amber-700 mb-1">Avisos:</p>
                    <ul className="space-y-0.5">
                      {uploadResult.warnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-600">
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!uploading && !uploadResult && (
              <div
                className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 flex items-center gap-5 hover:border-secondary hover:bg-blue-50/20 transition-colors cursor-pointer"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.add("border-secondary", "bg-blue-50/30");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove("border-secondary", "bg-blue-50/30");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove("border-secondary", "bg-blue-50/30");
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".csv,.xlsx,.xls";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFileUpload(file);
                  };
                  input.click();
                }}
              >
                <div className="h-14 w-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                  <Upload className="h-7 w-7 text-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Faça upload do faturamento</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Arraste um CSV ou Excel aqui, ou clique para selecionar
                  </p>
                </div>
              </div>
            )}
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
          {/* Royalties */}
          <CollapsibleSection
            title="Royalties"
            open={openSections.royalty}
            onToggle={() => toggleSection("royalty")}
          >
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Percentual de royalties</Label>
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
                          ? "bg-secondary text-white"
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

          {/* Exceções */}
          <CollapsibleSection
            title="Exceções"
            open={openSections.exceções}
            onToggle={() => toggleSection("exceções")}
            subtitle={regras.exceções.length > 0 ? `${regras.exceções.length} exceç${regras.exceções.length === 1 ? "ão" : "ões"}` : undefined}
          >
            <ExcecoesEditor
              excecoes={regras.exceções}
              franqueados={franqueados}
              onChange={(excecoes) => setRegras((prev) => ({ ...prev, exceções: excecoes }))}
            />
          </CollapsibleSection>

          {/* Descontos */}
          <CollapsibleSection
            title="Descontos"
            open={openSections.descontos}
            onToggle={() => toggleSection("descontos")}
            subtitle={regras.descontos.length > 0 ? `${regras.descontos.length} desconto${regras.descontos.length === 1 ? "" : "s"}` : undefined}
          >
            <DescontosEditor
              descontos={regras.descontos}
              franqueados={franqueados}
              onChange={(descontos) => setRegras((prev) => ({ ...prev, descontos }))}
            />
          </CollapsibleSection>

          {/* Nota Fiscal */}
          <CollapsibleSection
            title="Nota Fiscal"
            open={openSections.notaFiscal}
            onToggle={() => toggleSection("notaFiscal")}
            subtitle="Configure a emissão por tipo de cobrança"
          >
            <div className="space-y-5">
              {/* Royalties */}
              <div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Royalties</p>
                    <p className="text-xs text-gray-400">Emitir NF para cobranças de royalties</p>
                  </div>
                  <TogglePill
                    label={nfConfig.royalty ? "Ativo" : "Inativo"}
                    active={nfConfig.royalty}
                    onToggle={() => setNfConfig((prev) => ({ ...prev, royalty: !prev.royalty }))}
                  />
                </div>
                <NfExceçãoSelector
                  label={nfConfig.royalty ? "Não emitir NF para:" : "Emitir NF apenas para:"}
                  franqueados={franqueados}
                  selecionados={nfConfig.exceçõesRoyalty}
                  onChange={(ids) => setNfConfig((prev) => ({ ...prev, exceçõesRoyalty: ids }))}
                />
              </div>

              <div className="border-t border-gray-100" />

              {/* Marketing */}
              <div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Taxa de Marketing</p>
                    <p className="text-xs text-gray-400">Emitir NF para cobranças de marketing/FNP</p>
                  </div>
                  <TogglePill
                    label={nfConfig.marketing ? "Ativo" : "Inativo"}
                    active={nfConfig.marketing}
                    onToggle={() => setNfConfig((prev) => ({ ...prev, marketing: !prev.marketing }))}
                  />
                </div>
                <NfExceçãoSelector
                  label={nfConfig.marketing ? "Não emitir NF para:" : "Emitir NF apenas para:"}
                  franqueados={franqueados}
                  selecionados={nfConfig.exceçõesMarketing}
                  onChange={(ids) => setNfConfig((prev) => ({ ...prev, exceçõesMarketing: ids }))}
                />
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* STEP 3 — CALCULANDO                         */}
      {/* ════════════════════════════════════════════ */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-10 w-10 text-secondary animate-spin mb-6" />
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Processando apuração</h2>

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
                    <Loader2 className="h-5 w-5 text-secondary animate-spin flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-200 flex-shrink-0" />
                  )}
                  <span className={cn(
                    "text-sm",
                    checkpoints > i ? "text-gray-900" : checkpoints === i ? "text-secondary" : "text-gray-400"
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
              caption={competencia}
            />
            <StatCard
              icon={<Calculator className="h-4 w-4 text-gray-400" />}
              label="A cobrar"
              value={formatCurrency(totalCobrar)}
              caption={`royalties ${regras.royaltyPercent}% + mkt ${regras.marketingPercent}%`}
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
              <table className="w-full text-sm" aria-label="Resultado da apuração">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-5 py-3 font-medium text-gray-500">Franqueado</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Faturamento</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Royalties</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Marketing</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Desconto</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Total</th>
                    <th className="px-5 py-3 font-medium text-gray-500">NF</th>
                    <th className="px-5 py-3 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r) => {
                    const nfLabels: string[] = [];
                    if (r.nfRoyalty) nfLabels.push("Royalties");
                    if (r.nfMarketing) nfLabels.push("Mkt");

                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          "border-b border-gray-50 transition-colors",
                          r.flagRevisao ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-gray-50/50"
                        )}
                      >
                        <td className="px-5 py-3">
                          <div>
                            <span className="font-medium text-gray-900">{r.nome}</span>
                            <div className="flex gap-1 mt-1">
                              {r.temExcecao && (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-50 text-purple-700" title={r.excecaoDescricao}>
                                  Exceção
                                </span>
                              )}
                              {r.temDesconto && (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700" title={r.descontoDescricao}>
                                  Desconto
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600 tabular-nums">{formatCurrency(r.faturamento)}</td>
                        <td className="px-5 py-3 text-right text-gray-600 tabular-nums">{formatCurrency(r.royalty)}</td>
                        <td className="px-5 py-3 text-right text-gray-600 tabular-nums">{formatCurrency(r.marketing)}</td>
                        <td className="px-5 py-3 text-right text-gray-600 tabular-nums">
                          {r.desconto > 0 ? (
                            <span className="text-blue-600">-{formatCurrency(r.desconto)}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-gray-900 tabular-nums">{formatCurrency(r.totalCobrar)}</td>
                        <td className="px-5 py-3">
                          {nfLabels.length > 0 ? (
                            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                              {nfLabels.join(" + ")}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                              —
                            </span>
                          )}
                        </td>
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
                    );
                  })}
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
              caption={competencia}
            />
            <StatCard
              icon={<Calculator className="h-4 w-4 text-gray-400" />}
              label="A cobrar"
              value={formatCurrency(totalCobrar)}
              caption={`royalties ${regras.royaltyPercent}% + mkt ${regras.marketingPercent}%`}
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
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Revisei os valores por franqueado</span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aprovacao.verificou}
                onChange={(e) => setAprovacao((prev) => ({ ...prev, verificou: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Verifiquei as divergencias sinalizadas</span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aprovacao.confirmou}
                onChange={(e) => setAprovacao((prev) => ({ ...prev, confirmou: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
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

            {/* Notificação de emissão */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Notificação de emissão</p>
              <p className="text-xs text-gray-400 mb-3">
                Avisa o franqueado que a cobrança foi emitida. Lembretes automáticos de vencimento são configurados nas{" "}
                <a href="/reguas" className="text-primary hover:underline">Réguas de Cobrança</a>.
              </p>
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

          {/* Nota Fiscal */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-semibold text-gray-900">Nota Fiscal</p>
            </div>

            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-gray-600">Royalties</p>
              {nfRoyaltyCount > 0 ? (
                <span className="text-sm font-medium text-emerald-700">
                  {nfRoyaltyCount} notas fiscais
                  {nfConfig.exceçõesRoyalty.length > 0 && (
                    <span className="text-xs text-gray-400 ml-1">
                      ({nfConfig.exceçõesRoyalty.length} exceç{nfConfig.exceçõesRoyalty.length === 1 ? "ão" : "ões"})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-sm text-gray-400">Não emitir</span>
              )}
            </div>

            <div className="border-t border-gray-100" />

            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-gray-600">Marketing</p>
              {nfMarketingCount > 0 ? (
                <span className="text-sm font-medium text-emerald-700">
                  {nfMarketingCount} notas fiscais
                  {nfConfig.exceçõesMarketing.length > 0 && (
                    <span className="text-xs text-gray-400 ml-1">
                      ({nfConfig.exceçõesMarketing.length} exceç{nfConfig.exceçõesMarketing.length === 1 ? "ão" : "ões"})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-sm text-gray-400">Não emitir</span>
              )}
            </div>

            <div className="border-t border-gray-100" />

            <div className="flex items-center justify-between py-2">
              <p className="text-sm font-medium text-gray-900">Total de NFs</p>
              <p className="text-sm font-bold text-gray-900">{totalNfs}</p>
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8 w-full max-w-lg">
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{resultados.length * 2}</p>
                <p className="text-xs text-gray-500 mt-1">cobrancas emitidas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatCurrency(totalCobrar)}</p>
                <p className="text-xs text-gray-500 mt-1">valor total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{totalNfs}</p>
                <p className="text-xs text-gray-500 mt-1">NFs emitidas</p>
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
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors"
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
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition-colors"
            >
              Continuar para Regras
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {currentStep === 2 && (
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition-colors"
            >
              Calcular apuração
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {currentStep === 4 && (
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition-colors"
            >
              Tudo certo, aprovar
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {currentStep === 5 && (
            <button
              onClick={handleNext}
              disabled={!canAprovar}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="h-4 w-4" />
              Aprovar
            </button>
          )}

          {currentStep === 6 && !emitido && (
            <button
              onClick={handleEmitir}
              disabled={emitindo}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
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
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
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
        <div className="text-left">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
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
          ? "bg-secondary text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      )}
    >
      {label}
    </button>
  );
}

function NfExceçãoSelector({
  label,
  franqueados,
  selecionados,
  onChange,
}: {
  label: string;
  franqueados: ApuracaoFranqueado[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);

  const disponiveis = franqueados.filter(
    (f) => !selecionados.includes(f.id) && f.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const selecionadosData = franqueados.filter((f) => selecionados.includes(f.id));

  const addExceção = (id: string) => {
    onChange([...selecionados, id]);
    setBusca("");
  };

  const removeExceção = (id: string) => {
    onChange(selecionados.filter((s) => s !== id));
  };

  return (
    <div className="mt-2">
      {/* Exceções selecionadas */}
      {selecionadosData.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
          <div className="flex flex-wrap gap-1.5">
            {selecionadosData.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700"
              >
                {f.nome.replace("Franquia ", "")}
                <button
                  onClick={() => removeExceção(f.id)}
                  className="hover:text-amber-900 transition-colors"
                  aria-label={`Remover ${f.nome}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Botão para abrir seletor */}
      {!aberto ? (
        <button
          onClick={() => setAberto(true)}
          className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
        >
          + Adicionar exceção
        </button>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar franqueado..."
              className="w-full pl-9 pr-8 py-2 text-sm border-b border-gray-200 focus:outline-none focus:border-secondary"
              autoFocus
            />
            <button
              onClick={() => { setAberto(false); setBusca(""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Lista */}
          <div className="max-h-40 overflow-y-auto">
            {disponiveis.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">
                {busca ? "Nenhum franqueado encontrado" : "Todos já adicionados"}
              </p>
            ) : (
              disponiveis.map((f) => (
                <button
                  key={f.id}
                  onClick={() => addExceção(f.id)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <span>{f.nome}</span>
                  <span className="text-xs text-gray-400">Adicionar</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXCEÇÕES EDITOR
// ============================================

function ExcecoesEditor({
  excecoes,
  franqueados,
  onChange,
}: {
  excecoes: ExcecaoApuracao[];
  franqueados: ApuracaoFranqueado[];
  onChange: (excecoes: ExcecaoApuracao[]) => void;
}) {
  const [novaExcecao, setNovaExcecao] = useState({ franqueadoId: "", descricao: "" });

  const addExcecao = () => {
    if (!novaExcecao.franqueadoId || !novaExcecao.descricao.trim()) return;
    onChange([...excecoes, { franqueadoId: novaExcecao.franqueadoId, descricao: novaExcecao.descricao.trim() }]);
    setNovaExcecao({ franqueadoId: "", descricao: "" });
  };

  const removeExcecao = (idx: number) => {
    onChange(excecoes.filter((_, i) => i !== idx));
  };

  const disponiveis = franqueados.filter((f) => !excecoes.some((e) => e.franqueadoId === f.id));

  return (
    <div className="space-y-4">
      {excecoes.length > 0 && (
        <div className="space-y-2">
          {excecoes.map((exc, idx) => {
            const fq = franqueados.find((f) => f.id === exc.franqueadoId);
            return (
              <div key={idx} className="flex items-center justify-between p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">{fq?.nome ?? exc.franqueadoId}</p>
                  <p className="text-xs text-gray-500">{exc.descricao}</p>
                </div>
                <button
                  onClick={() => removeExcecao(idx)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs text-gray-500">Franqueado</Label>
          <Select
            value={novaExcecao.franqueadoId}
            onValueChange={(v) => setNovaExcecao((prev) => ({ ...prev, franqueadoId: v }))}
          >
            <SelectTrigger className="h-9 mt-1">
              <SelectValue placeholder="Selecionar franqueado…" />
            </SelectTrigger>
            <SelectContent>
              {disponiveis.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-xs text-gray-500">Descrição</Label>
          <Input
            value={novaExcecao.descricao}
            onChange={(e) => setNovaExcecao((prev) => ({ ...prev, descricao: e.target.value }))}
            placeholder="Descreva a exceção…"
            className="h-9 mt-1"
          />
        </div>
        <button
          onClick={addExcecao}
          disabled={!novaExcecao.franqueadoId || !novaExcecao.descricao.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary border border-primary/25 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>

      {excecoes.length === 0 && (
        <p className="text-xs text-gray-400">Nenhuma exceção configurada. Exceções são refletidas como notas no resultado.</p>
      )}
    </div>
  );
}

// ============================================
// DESCONTOS EDITOR
// ============================================

function DescontosEditor({
  descontos,
  franqueados,
  onChange,
}: {
  descontos: DescontoApuracao[];
  franqueados: ApuracaoFranqueado[];
  onChange: (descontos: DescontoApuracao[]) => void;
}) {
  const [novoDesconto, setNovoDesconto] = useState<{
    franqueadoId: string;
    tipo: "percentual" | "fixo";
    valor: string;
    descricao: string;
    ciclos: string;
  }>({ franqueadoId: "", tipo: "percentual", valor: "", descricao: "", ciclos: "0" });

  const addDesconto = () => {
    if (!novoDesconto.franqueadoId || !novoDesconto.valor) return;
    const valorNum = parseFloat(novoDesconto.valor);
    if (isNaN(valorNum) || valorNum <= 0) return;

    onChange([
      ...descontos,
      {
        franqueadoId: novoDesconto.franqueadoId,
        tipo: novoDesconto.tipo,
        valor: novoDesconto.tipo === "fixo" ? Math.round(valorNum * 100) : valorNum,
        descricao: novoDesconto.descricao.trim() || `Desconto ${novoDesconto.tipo === "percentual" ? `${valorNum}%` : `R$ ${valorNum}`}`,
        ciclos: parseInt(novoDesconto.ciclos) || 0,
      },
    ]);
    setNovoDesconto({ franqueadoId: "", tipo: "percentual", valor: "", descricao: "", ciclos: "0" });
  };

  const removeDesconto = (idx: number) => {
    onChange(descontos.filter((_, i) => i !== idx));
  };

  const disponiveis = franqueados.filter((f) => !descontos.some((d) => d.franqueadoId === f.id));

  function fmtDescontoValor(d: DescontoApuracao): string {
    if (d.tipo === "percentual") return `${d.valor}%`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(d.valor / 100);
  }

  return (
    <div className="space-y-4">
      {descontos.length > 0 && (
        <div className="space-y-2">
          {descontos.map((desc, idx) => {
            const fq = franqueados.find((f) => f.id === desc.franqueadoId);
            return (
              <div key={idx} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">{fq?.nome ?? desc.franqueadoId}</p>
                  <p className="text-xs text-gray-500">
                    {fmtDescontoValor(desc)} — {desc.descricao}
                    {desc.ciclos > 0 && <span className="ml-1 text-blue-600">({desc.ciclos} ciclo{desc.ciclos > 1 ? "s" : ""})</span>}
                    {desc.ciclos === 0 && <span className="ml-1 text-blue-600">(permanente)</span>}
                  </p>
                </div>
                <button
                  onClick={() => removeDesconto(idx)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500">Franqueado</Label>
            <Select
              value={novoDesconto.franqueadoId}
              onValueChange={(v) => setNovoDesconto((prev) => ({ ...prev, franqueadoId: v }))}
            >
              <SelectTrigger className="h-9 mt-1">
                <SelectValue placeholder="Selecionar…" />
              </SelectTrigger>
              <SelectContent>
                {disponiveis.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Tipo</Label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setNovoDesconto((prev) => ({ ...prev, tipo: "percentual" }))}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  novoDesconto.tipo === "percentual"
                    ? "bg-secondary text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                Percentual
              </button>
              <button
                onClick={() => setNovoDesconto((prev) => ({ ...prev, tipo: "fixo" }))}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  novoDesconto.tipo === "fixo"
                    ? "bg-secondary text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                Valor Fixo
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-gray-500">Valor {novoDesconto.tipo === "percentual" ? "(%)" : "(R$)"}</Label>
            <Input
              type="number"
              step={novoDesconto.tipo === "percentual" ? "0.5" : "0.01"}
              min="0"
              value={novoDesconto.valor}
              onChange={(e) => setNovoDesconto((prev) => ({ ...prev, valor: e.target.value }))}
              placeholder="0"
              className="h-9 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Descrição</Label>
            <Input
              value={novoDesconto.descricao}
              onChange={(e) => setNovoDesconto((prev) => ({ ...prev, descricao: e.target.value }))}
              placeholder="Motivo do desconto…"
              className="h-9 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Aplicar por</Label>
            <Select
              value={novoDesconto.ciclos}
              onValueChange={(v) => setNovoDesconto((prev) => ({ ...prev, ciclos: v }))}
            >
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Permanente</SelectItem>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} ciclo{n > 1 ? "s" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={addDesconto}
            disabled={!novoDesconto.franqueadoId || !novoDesconto.valor}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary border border-primary/25 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar desconto
          </button>
        </div>
      </div>

      {descontos.length === 0 && (
        <p className="text-xs text-gray-400">Nenhum desconto neste ciclo. Descontos são subtraídos do total por franqueado.</p>
      )}
    </div>
  );
}
