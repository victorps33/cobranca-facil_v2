import { Prisma, PrismaClient } from "@prisma/client";

// Transaction client type (works with prisma.$transaction)
type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ── Template presets (shared with seed) ──

export const TEMPLATE_EMAIL_D5 = `Olá, {{nome}}! 😊
Só um lembrete de que a cobrança **{{descricao}}** no valor de **{{valor}}** vence em **{{vencimento}}**.
Boleto: {{link_boleto}}
Se já estiver tudo certo, pode ignorar esta mensagem. Obrigado!`;

export const TEMPLATE_WHATSAPP_D1 = `Oi, {{nome}}! Lembrete: **{{descricao}}** ({{valor}}) vence amanhã ({{vencimento}}). Boleto: {{link_boleto}}`;

export const TEMPLATE_SMS_D3 = `{{nome}}, a cobrança {{descricao}} ({{valor}}) venceu em {{vencimento}}. Para pagar: {{link_boleto}}`;

export const TEMPLATE_WHATSAPP_D7 = `Oi, {{nome}}. A cobrança **{{descricao}}** ({{valor}}) segue em aberto desde **{{vencimento}}**. 2ª via: {{link_boleto}}. Se precisar negociar, me avise.`;

export const DEFAULT_DUNNING_STEPS: Array<{
  trigger: "BEFORE_DUE" | "AFTER_DUE";
  offsetDays: number;
  channel: "EMAIL" | "WHATSAPP" | "SMS";
  template: string;
}> = [
  { trigger: "BEFORE_DUE", offsetDays: 5, channel: "EMAIL", template: TEMPLATE_EMAIL_D5 },
  { trigger: "BEFORE_DUE", offsetDays: 1, channel: "WHATSAPP", template: TEMPLATE_WHATSAPP_D1 },
  { trigger: "AFTER_DUE", offsetDays: 3, channel: "SMS", template: TEMPLATE_SMS_D3 },
  { trigger: "AFTER_DUE", offsetDays: 7, channel: "WHATSAPP", template: TEMPLATE_WHATSAPP_D7 },
];

export async function createDefaultDunningRule(
  tx: PrismaTransactionClient,
  franqueadoraId: string
): Promise<void> {
  const rule = await tx.dunningRule.create({
    data: {
      name: "Régua Padrão",
      active: true,
      timezone: "America/Sao_Paulo",
      franqueadoraId,
    },
  });

  await Promise.all(
    DEFAULT_DUNNING_STEPS.map((step) =>
      tx.dunningStep.create({
        data: {
          ruleId: rule.id,
          trigger: step.trigger,
          offsetDays: step.offsetDays,
          channel: step.channel,
          template: step.template,
          enabled: true,
        },
      })
    )
  );
}
