"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { Stepper } from "@/components/ui/stepper";
import { PaymentOptionCard } from "@/components/ui/payment-option-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  Loader2,
  FileText,
  CreditCard,
  QrCode,
  Barcode,
  User,
  Mail,
  Phone,
  FileCheck,
  Calendar,
  DollarSign,
  Percent,
  Check,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/cn";

interface Customer {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
}

interface FormData {
  // Step 1 - Dados da Cobrança
  description: string;
  chargeType: "avista" | "parcelado" | "recorrente";
  installments: number;
  dueDate: string;
  amount: string;
  paymentMethods: string[];
  passFeesToCustomer: boolean;
  anticipate: boolean;
  // Recorrente
  recorrenciaPeriodo: "mensal" | "trimestral" | "semestral" | "anual";
  recorrenciaCiclos: string; // "sem_fim" = sem fim
  // Step 2 - Juros e Multa
  interestPercent: string;
  fineType: "percent" | "fixed";
  fineValue: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  discountDeadline: string;
  // Step 3 - Cliente
  customerId: string;
  customerName: string;
  customerDoc: string;
  customerEmail: string;
  customerPhone: string;
  isNewCustomer: boolean;
}

const STEPS = [
  { id: 1, name: "Dados da Cobrança", description: "Valor e pagamento" },
  { id: 2, name: "Juros e Multa", description: "Configurações" },
  { id: 3, name: "Cliente", description: "Dados do pagador" },
  { id: 4, name: "Resumo", description: "Confirmar dados" },
];

const initialFormData: FormData = {
  description: "",
  chargeType: "avista",
  installments: 1,
  dueDate: "",
  amount: "",
  paymentMethods: ["boleto"],
  passFeesToCustomer: false,
  anticipate: false,
  recorrenciaPeriodo: "mensal",
  recorrenciaCiclos: "sem_fim",
  interestPercent: "1",
  fineType: "percent",
  fineValue: "2",
  discountType: "percent",
  discountValue: "",
  discountDeadline: "due_date",
  customerId: "",
  customerName: "",
  customerDoc: "",
  customerEmail: "",
  customerPhone: "",
  isNewCustomer: false,
};

export default function NovaCobrancaPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      // Garantir que data é um array (API pode retornar erro se tenant não configurado)
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
    }
  };

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const togglePaymentMethod = (method: string) => {
    const current = formData.paymentMethods;
    if (current.includes(method)) {
      if (current.length > 1) {
        updateFormData({ paymentMethods: current.filter((m) => m !== method) });
      }
    } else {
      updateFormData({ paymentMethods: [...current, method] });
    }
  };

  const selectCustomer = (customer: Customer) => {
    updateFormData({
      customerId: customer.id,
      customerName: customer.nome,
      customerDoc: customer.cnpj,
      customerEmail: customer.email,
      isNewCustomer: false,
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return (
          formData.description &&
          formData.amount &&
          formData.dueDate &&
          formData.paymentMethods.length > 0
        );
      case 2:
        return true; // Optional fields
      case 3:
        return formData.customerId || (formData.customerName && formData.customerDoc && formData.customerEmail);
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Create customer if new
      let customerId = formData.customerId;
      if (formData.isNewCustomer || !customerId) {
        const customerRes = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.customerName,
            doc: formData.customerDoc,
            email: formData.customerEmail,
            phone: formData.customerPhone || "00000000000",
          }),
        });
        if (!customerRes.ok) throw new Error("Erro ao criar cliente");
        const customerData = await customerRes.json();
        customerId = customerData.id;
      }

      // Create charge
      const chargeRes = await fetch("/api/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          description: formData.description,
          amountCents: Math.round(parseFloat(formData.amount) * 100),
          dueDate: formData.dueDate,
        }),
      });

      if (!chargeRes.ok) throw new Error("Erro ao criar cobrança");

      toast({
        title: "Cobrança criada!",
        description: "Tudo certo. Mais que fluxo, fluidez.",
      });

      router.push("/cobrancas");
    } catch (error) {
      toast({
        title: "Erro ao criar cobrança",
        description: "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Nova Cobrança Avulsa</h1>
            <p className="text-xs text-gray-400 mt-0.5">Cobranças do ciclo de apuração são emitidas automaticamente na Apuração.</p>
          </div>
          <button
            onClick={() => router.push("/cobrancas")}
            aria-label="Fechar"
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <Stepper
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={(step) => step < currentStep && setCurrentStep(step)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          {/* Step 1: Dados da Cobrança */}
          {currentStep === 1 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">O que cobrar?</h2>
                <p className="text-sm text-gray-500 mb-4">Descreva o produto ou serviço</p>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder="Ex: Mensalidade Janeiro, Consultoria, Produto XYZ…"
                  className="w-full h-24 px-4 py-3 border border-gray-200 rounded-xl resize-none focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary/20 outline-none transition-colors"
                />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Tipo de cobrança</h2>
                <div className="flex gap-2 mt-3">
                  {[
                    { id: "avista", label: "À vista" },
                    { id: "parcelado", label: "Parcelado" },
                    { id: "recorrente", label: "Recorrente" },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => updateFormData({
                        chargeType: type.id as any,
                        ...(type.id === "parcelado" ? { installments: 2 } : {}),
                      })}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                        formData.chargeType === type.id
                          ? "bg-secondary text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                {formData.chargeType === "recorrente" && (
                  <p className="text-xs text-gray-400 mt-2">
                    A cobrança será gerada automaticamente com a periodicidade escolhida.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Valor (R$)</Label>
                  <div className="relative mt-2">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                    <Input
                      name="amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      value={formData.amount}
                      onChange={(e) => updateFormData({ amount: e.target.value })}
                      placeholder="0,00"
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Vencimento</Label>
                  <div className="relative mt-2">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                    <Input
                      name="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => updateFormData({ dueDate: e.target.value })}
                      className="pl-10 h-11"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </div>
              </div>

              {formData.chargeType === "parcelado" && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">Número de parcelas</Label>
                  <Select
                    value={String(formData.installments)}
                    onValueChange={(v) => updateFormData({ installments: parseInt(v) })}
                  >
                    <SelectTrigger className="w-full mt-2 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x de {formData.amount ? formatCurrency((parseFloat(formData.amount) * 100) / n) : "R$ 0,00"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.chargeType === "recorrente" && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Periodicidade</Label>
                    <Select
                      value={formData.recorrenciaPeriodo}
                      onValueChange={(v) => updateFormData({ recorrenciaPeriodo: v as any })}
                    >
                      <SelectTrigger className="w-full mt-2 h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="semestral">Semestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Quantidade de ciclos</Label>
                    <Select
                      value={formData.recorrenciaCiclos}
                      onValueChange={(v) => updateFormData({ recorrenciaCiclos: v })}
                    >
                      <SelectTrigger className="w-full mt-2 h-11">
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem_fim">Sem fim (até cancelar)</SelectItem>
                        {[3, 6, 12, 24, 36].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} ciclos
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Forma de pagamento</h2>
                <p className="text-sm text-gray-500 mb-4">Selecione as opções disponíveis para o cliente</p>
                <div className="space-y-3">
                  <PaymentOptionCard
                    id="boleto"
                    icon={Barcode}
                    title="Boleto Bancário"
                    description="Pagamento em até 3 dias úteis"
                    fee="R$ 1,99 por boleto"
                    timing="Receba em D+2"
                    selected={formData.paymentMethods.includes("boleto")}
                    onSelect={togglePaymentMethod}
                  />
                  <PaymentOptionCard
                    id="pix"
                    icon={QrCode}
                    title="Pix"
                    description="Pagamento instantâneo"
                    fee="0,99%"
                    timing="Receba na hora"
                    selected={formData.paymentMethods.includes("pix")}
                    onSelect={togglePaymentMethod}
                  />
                  <PaymentOptionCard
                    id="cartao"
                    icon={CreditCard}
                    title="Cartão de Crédito"
                    description="Parcelamento disponível"
                    fee="2,99% + R$ 0,49"
                    timing="Receba em D+30"
                    selected={formData.paymentMethods.includes("cartao")}
                    onSelect={togglePaymentMethod}
                  />
                </div>
              </div>

              {formData.paymentMethods.includes("cartao") && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">Repassar taxas ao cliente</p>
                    <p className="text-sm text-gray-500">O cliente pagará a taxa do cartão</p>
                  </div>
                  <Switch
                    checked={formData.passFeesToCustomer}
                    onCheckedChange={(checked) => updateFormData({ passFeesToCustomer: checked })}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Juros e Multa */}
          {currentStep === 2 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Juros por atraso</h2>
                <p className="text-sm text-gray-500 mb-4">Aplicado após o vencimento (ao mês)</p>
                <div className="relative max-w-xs">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.interestPercent}
                    onChange={(e) => updateFormData({ interestPercent: e.target.value })}
                    className="h-11 pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                </div>
                {formData.amount && formData.interestPercent && (
                  <p className="text-sm text-gray-500 mt-2">
                    Valor: {formatCurrency((parseFloat(formData.amount) * 100 * parseFloat(formData.interestPercent)) / 100)} por mês
                  </p>
                )}
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Multa por atraso</h2>
                <p className="text-sm text-gray-500 mb-4">Aplicada uma única vez após o vencimento</p>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => updateFormData({ fineType: "percent" })}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                      formData.fineType === "percent"
                        ? "bg-secondary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    Percentual
                  </button>
                  <button
                    onClick={() => updateFormData({ fineType: "fixed" })}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                      formData.fineType === "fixed"
                        ? "bg-secondary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    Valor Fixo
                  </button>
                </div>
                <div className="relative max-w-xs">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.fineValue}
                    onChange={(e) => updateFormData({ fineValue: e.target.value })}
                    className="h-11 pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {formData.fineType === "percent" ? "%" : "R$"}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-gray-900">Desconto</h2>
                  <button className="text-gray-400 hover:text-gray-600">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-4">Conceda desconto para pagamento antecipado (opcional)</p>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => updateFormData({ discountType: "percent" })}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                      formData.discountType === "percent"
                        ? "bg-secondary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    Percentual
                  </button>
                  <button
                    onClick={() => updateFormData({ discountType: "fixed" })}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                      formData.discountType === "fixed"
                        ? "bg-secondary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    Valor Fixo
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.discountValue}
                      onChange={(e) => updateFormData({ discountValue: e.target.value })}
                      placeholder="0"
                      className="h-11 pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {formData.discountType === "percent" ? "%" : "R$"}
                    </span>
                  </div>
                  <Select
                    value={formData.discountDeadline}
                    onValueChange={(v) => updateFormData({ discountDeadline: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Prazo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="due_date">Até o vencimento</SelectItem>
                      <SelectItem value="5_days">5 dias antes</SelectItem>
                      <SelectItem value="10_days">10 dias antes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Cliente */}
          {currentStep === 3 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Selecionar cliente</h2>
                <p className="text-sm text-gray-500 mb-4">Escolha um cliente existente ou cadastre um novo</p>
                
                {customers.length > 0 && !formData.isNewCustomer && (
                  <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => selectCustomer(customer)}
                        className={cn(
                          "w-full flex items-center gap-3 p-4 rounded-xl border transition-[border-color,box-shadow] text-left",
                          formData.customerId === customer.id
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center text-sm font-semibold text-gray-600">
                          {customer.nome.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{customer.nome}</p>
                          <p className="text-sm text-gray-500">{customer.email}</p>
                        </div>
                        {formData.customerId === customer.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => updateFormData({ isNewCustomer: true, customerId: "" })}
                  className={cn(
                    "w-full p-4 rounded-xl border-2 border-dashed transition-colors text-center",
                    formData.isNewCustomer
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <User className="h-6 w-6 text-gray-400 mx-auto mb-2" aria-hidden="true" />
                  <p className="font-medium text-gray-900">Cadastrar novo cliente</p>
                </button>
              </div>

              {formData.isNewCustomer && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Nome completo</Label>
                    <div className="relative mt-2">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                      <Input
                        name="customerName"
                        autoComplete="name"
                        value={formData.customerName}
                        onChange={(e) => updateFormData({ customerName: e.target.value })}
                        placeholder="Nome do cliente…"
                        className="pl-10 h-11"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">CPF/CNPJ</Label>
                    <div className="relative mt-2">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                      <Input
                        name="customerDoc"
                        value={formData.customerDoc}
                        onChange={(e) => updateFormData({ customerDoc: e.target.value })}
                        placeholder="000.000.000-00"
                        className="pl-10 h-11"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">E-mail</Label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                      <Input
                        name="customerEmail"
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        value={formData.customerEmail}
                        onChange={(e) => updateFormData({ customerEmail: e.target.value })}
                        placeholder="email@exemplo.com"
                        className="pl-10 h-11"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Telefone (opcional)</Label>
                    <div className="relative mt-2">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                      <Input
                        name="customerPhone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={formData.customerPhone}
                        onChange={(e) => updateFormData({ customerPhone: e.target.value })}
                        placeholder="(00) 00000-0000"
                        className="pl-10 h-11"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Resumo */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumo da cobrança</h2>
                
                <div className="bg-background rounded-xl p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-600">Descrição</span>
                    <span className="text-sm font-medium text-gray-900 text-right max-w-xs">{formData.description}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Valor</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(parseFloat(formData.amount || "0") * 100)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Vencimento</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formData.dueDate ? new Date(formData.dueDate).toLocaleDateString("pt-BR") : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Forma de pagamento</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formData.paymentMethods.map((m) => 
                        m === "boleto" ? "Boleto" : m === "pix" ? "Pix" : "Cartão"
                      ).join(", ")}
                    </span>
                  </div>
                  {formData.interestPercent && parseFloat(formData.interestPercent) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Juros</span>
                      <span className="text-sm font-medium text-gray-900">{formData.interestPercent}% ao mês</span>
                    </div>
                  )}
                  {formData.fineValue && parseFloat(formData.fineValue) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Multa</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formData.fineType === "percent" ? `${formData.fineValue}%` : formatCurrency(parseFloat(formData.fineValue) * 100)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cliente</span>
                      <span className="text-sm font-medium text-gray-900">{formData.customerName}</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-sm text-gray-600">E-mail</span>
                      <span className="text-sm text-gray-900">{formData.customerEmail}</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500 text-center">
                Ao confirmar, a cobrança será criada e o cliente receberá as instruções de pagamento por e-mail.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between mt-6">
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
            Voltar
          </button>

          {currentStep < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Avançar
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Criar Cobrança
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
