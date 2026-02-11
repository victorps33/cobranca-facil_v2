import { prisma } from "./prisma";
import { format, addDays, subDays, startOfDay, parseISO } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { createHash } from "crypto";

// ============================================
// TIME UTILITIES
// ============================================

export async function getAppNow(): Promise<Date> {
  const appState = await prisma.appState.findUnique({
    where: { id: 1 },
  });

  if (appState?.simulatedNow) {
    return new Date(appState.simulatedNow);
  }

  return new Date();
}

export async function setSimulatedNow(date: Date | null): Promise<void> {
  await prisma.appState.upsert({
    where: { id: 1 },
    update: { simulatedNow: date },
    create: { id: 1, simulatedNow: date },
  });
}

export async function advanceTime(days: number): Promise<Date> {
  const currentNow = await getAppNow();
  const newNow = addDays(currentNow, days);
  await setSimulatedNow(newNow);
  return newNow;
}

export async function resetTime(): Promise<void> {
  await setSimulatedNow(null);
}

export async function getAppNowInfo(): Promise<{
  date: Date;
  isSimulated: boolean;
}> {
  const appState = await prisma.appState.findUnique({
    where: { id: 1 },
  });

  if (appState?.simulatedNow) {
    return { date: new Date(appState.simulatedNow), isSimulated: true };
  }

  return { date: new Date(), isSimulated: false };
}

// ============================================
// OVERDUE STATUS UPDATE
// ============================================

export async function ensureOverdueStatus(): Promise<number> {
  const now = await getAppNow();
  const todayStart = startOfDay(now);

  const result = await prisma.charge.updateMany({
    where: {
      status: "PENDING",
      dueDate: {
        lt: todayStart,
      },
    },
    data: {
      status: "OVERDUE",
    },
  });

  return result.count;
}

// ============================================
// BOLETO GENERATION
// ============================================

export function generateBoletoData(
  chargeId: string,
  amountCents: number,
  dueDate: Date
): { linhaDigitavel: string; barcodeValue: string } {
  // Create deterministic hash from charge data
  const dataString = `${chargeId}-${amountCents}-${dueDate.toISOString()}`;
  const hash = createHash("sha256").update(dataString).digest("hex");

  // Generate fake linha digitavel (47 digits)
  const linhaDigitavel = hash
    .replace(/[a-f]/gi, (m) => String(m.charCodeAt(0) % 10))
    .slice(0, 47)
    .replace(/(\d{5})(\d{5})(\d{5})(\d{6})(\d{5})(\d{6})(\d{1})(\d{14})/, "$1.$2 $3.$4 $5.$6 $7 $8");

  // Generate fake barcode value (44 digits)
  const barcodeValue = hash
    .replace(/[a-f]/gi, (m) => String(m.charCodeAt(0) % 10))
    .slice(0, 44);

  return { linhaDigitavel, barcodeValue };
}

// ============================================
// TEMPLATE ENGINE
// ============================================

export interface TemplateVars {
  nome: string;
  valor: string;
  vencimento: string;
  link_boleto: string;
  descricao: string;
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  let result = template;
  result = result.replace(/\{\{nome\}\}/g, vars.nome);
  result = result.replace(/\{\{valor\}\}/g, vars.valor);
  result = result.replace(/\{\{vencimento\}\}/g, vars.vencimento);
  result = result.replace(/\{\{link_boleto\}\}/g, vars.link_boleto);
  result = result.replace(/\{\{descricao\}\}/g, vars.descricao);
  return result;
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatDate(date: Date): string {
  return format(date, "dd/MM/yyyy");
}

export function formatDateTime(date: Date): string {
  return format(date, "dd/MM/yyyy HH:mm");
}

// ============================================
// DUNNING SCHEDULED DATE CALCULATION
// ============================================

export function calculateScheduledDate(
  dueDate: Date,
  trigger: "BEFORE_DUE" | "ON_DUE" | "AFTER_DUE",
  offsetDays: number,
  timezone: string = "America/Sao_Paulo"
): Date {
  // Convert dueDate to timezone
  const dueDateInTz = toZonedTime(dueDate, timezone);
  const dueDateStart = startOfDay(dueDateInTz);

  let scheduledDate: Date;

  switch (trigger) {
    case "BEFORE_DUE":
      scheduledDate = subDays(dueDateStart, offsetDays);
      break;
    case "ON_DUE":
      scheduledDate = dueDateStart;
      break;
    case "AFTER_DUE":
      scheduledDate = addDays(dueDateStart, offsetDays);
      break;
    default:
      scheduledDate = dueDateStart;
  }

  // Convert back from timezone to UTC for storage
  return fromZonedTime(scheduledDate, timezone);
}

// ============================================
// TEMPLATE PRESETS
// ============================================

export const TEMPLATE_PRESETS = [
  {
    id: "email_d5",
    name: "EMAIL (D-5)",
    channel: "EMAIL" as const,
    trigger: "BEFORE_DUE" as const,
    offsetDays: 5,
    template: `Olá, {{nome}}! 😊
Só um lembrete de que a cobrança **{{descricao}}** no valor de **{{valor}}** vence em **{{vencimento}}**.
Boleto: {{link_boleto}}
Se já estiver tudo certo, pode ignorar esta mensagem. Obrigado!`,
  },
  {
    id: "whatsapp_d1",
    name: "WHATSAPP (D-1)",
    channel: "WHATSAPP" as const,
    trigger: "BEFORE_DUE" as const,
    offsetDays: 1,
    template: `Oi, {{nome}}! Lembrete: **{{descricao}}** ({{valor}}) vence amanhã ({{vencimento}}). Boleto: {{link_boleto}}`,
  },
  {
    id: "on_due_d0",
    name: "ON_DUE (D0)",
    channel: "EMAIL" as const,
    trigger: "ON_DUE" as const,
    offsetDays: 0,
    template: `Olá, {{nome}}! Hoje é o vencimento de **{{descricao}}** ({{valor}}). 2ª via: {{link_boleto}}`,
  },
  {
    id: "sms_d3",
    name: "SMS (D+3)",
    channel: "SMS" as const,
    trigger: "AFTER_DUE" as const,
    offsetDays: 3,
    template: `{{nome}}, a cobrança {{descricao}} ({{valor}}) venceu em {{vencimento}}. Para pagar: {{link_boleto}}`,
  },
  {
    id: "whatsapp_d7",
    name: "WHATSAPP (D+7)",
    channel: "WHATSAPP" as const,
    trigger: "AFTER_DUE" as const,
    offsetDays: 7,
    template: `Oi, {{nome}}. A cobrança **{{descricao}}** ({{valor}}) segue em aberto desde **{{vencimento}}**. 2ª via: {{link_boleto}}. Se precisar negociar, me avise.`,
  },
];

// ============================================
// STATUS HELPERS
// ============================================

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELED: "Cancelado",
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELED: "bg-gray-100 text-gray-800",
};

export const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "E-mail",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
};

export const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-100 text-blue-800",
  SMS: "bg-purple-100 text-purple-800",
  WHATSAPP: "bg-green-100 text-green-800",
};

export const TRIGGER_LABELS: Record<string, string> = {
  BEFORE_DUE: "Antes do vencimento",
  ON_DUE: "No vencimento",
  AFTER_DUE: "Após vencimento",
};

export const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  SENT: "Enviado",
  FAILED: "Falhou",
  SKIPPED: "Ignorado",
};

export const NOTIFICATION_STATUS_COLORS: Record<string, string> = {
  SENT: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  SKIPPED: "bg-gray-100 text-gray-800",
};

// ============================================
// CRM HELPERS
// ============================================

export const INTERACTION_TYPE_LABELS: Record<string, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  TELEFONE: "Telefone",
  NOTA_INTERNA: "Nota Interna",
};

export const INTERACTION_TYPE_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-50 text-blue-700",
  WHATSAPP: "bg-green-50 text-green-700",
  SMS: "bg-purple-50 text-purple-700",
  TELEFONE: "bg-amber-50 text-amber-700",
  NOTA_INTERNA: "bg-gray-100 text-gray-700",
};

export const DIRECTION_LABELS: Record<string, string> = {
  INBOUND: "Recebido",
  OUTBOUND: "Enviado",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em Andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  PENDENTE: "bg-yellow-50 text-yellow-700",
  EM_ANDAMENTO: "bg-blue-50 text-blue-700",
  CONCLUIDA: "bg-emerald-50 text-emerald-700",
  CANCELADA: "bg-gray-100 text-gray-500",
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  BAIXA: "bg-gray-100 text-gray-600",
  MEDIA: "bg-blue-50 text-blue-700",
  ALTA: "bg-amber-50 text-amber-700",
  CRITICA: "bg-red-50 text-red-700",
};

// ============================================
// CONVERSATION / INBOX HELPERS
// ============================================

export const CONVERSATION_STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  PENDENTE_IA: "Pendente IA",
  PENDENTE_HUMANO: "Pendente Humano",
  RESOLVIDA: "Resolvida",
};

export const CONVERSATION_STATUS_COLORS: Record<string, string> = {
  ABERTA: "text-green-700 bg-green-50",
  PENDENTE_IA: "text-yellow-700 bg-yellow-50",
  PENDENTE_HUMANO: "text-red-700 bg-red-50",
  RESOLVIDA: "text-gray-500 bg-gray-100",
};

export const CONVERSATION_STATUS_DOT_COLORS: Record<string, string> = {
  ABERTA: "bg-green-400",
  PENDENTE_IA: "bg-yellow-400",
  PENDENTE_HUMANO: "bg-red-400",
  RESOLVIDA: "bg-gray-300",
};
