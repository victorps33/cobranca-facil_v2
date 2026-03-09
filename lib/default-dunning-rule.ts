import { Channel, DunningPhase, DunningTrigger, RiskProfile } from "@prisma/client";

interface DefaultStep {
  trigger: DunningTrigger;
  offsetDays: number;
  channel: Channel;
  template: string;
  phase: DunningPhase;
}

interface DefaultDunningRule {
  name: string;
  riskProfile: RiskProfile;
  maxPhase: DunningPhase;
  steps: DefaultStep[];
}

// ── Templates ──

const T_LEMBRETE_EMAIL = `Olá {{nome}}, tudo bem?\n\nSua fatura no valor de {{valor}} vence em {{vencimento}}.\n\nAcesse o boleto: {{link_boleto}}\n\nQualquer dúvida, estamos à disposição!`;

const T_LEMBRETE_SMS = `{{nome}}, sua fatura de {{valor}} vence em {{vencimento}}. Boleto: {{link_boleto}}`;

const T_LEMBRETE_WHATSAPP = `Oi {{nome}}! 😊 Passando para lembrar que sua fatura de *{{valor}}* vence em *{{vencimento}}*.\n\nBoleto: {{link_boleto}}`;

const T_VENCIMENTO_WHATSAPP = `Oi {{nome}}, sua fatura de *{{valor}}* vence *hoje*.\n\nBoleto: {{link_boleto}}\n\nSe já pagou, desconsidere! 🙏`;

const T_ATRASO_SMS = `{{nome}}, sua fatura de {{valor}} (venc. {{vencimento}}) está em atraso. Regularize: {{link_boleto}}`;

const T_ATRASO_WHATSAPP = `Oi {{nome}}, notamos que a fatura de *{{valor}}* (venc. {{vencimento}}) ainda está em aberto.\n\nPodemos ajudar? Boleto atualizado: {{link_boleto}}`;

const T_COBRANCA_SMS = `{{nome}}, sua fatura de {{valor}} está com {{dias_atraso}} dias de atraso. Evite negativação. Regularize: {{link_boleto}}`;

const T_COBRANCA_WHATSAPP = `{{nome}}, sua fatura de *{{valor}}* está com *{{dias_atraso}} dias* de atraso.\n\nÉ importante regularizar para evitar medidas de negativação e protesto.\n\nBoleto: {{link_boleto}}`;

const T_POS_PROTESTO_SMS = `{{nome}}, sua fatura de {{valor}} foi protestada. Entre em contato urgente para regularização.`;

const T_POS_PROTESTO_WHATSAPP = `{{nome}}, informamos que a fatura de *{{valor}}* foi protestada em cartório.\n\nEntre em contato para negociação e regularização do título.`;

// ── Steps por fase ──

const STEPS_LEMBRETE: DefaultStep[] = [
  { trigger: "BEFORE_DUE", offsetDays: 5, channel: "EMAIL", template: T_LEMBRETE_EMAIL, phase: "LEMBRETE" },
  { trigger: "BEFORE_DUE", offsetDays: 3, channel: "SMS", template: T_LEMBRETE_SMS, phase: "LEMBRETE" },
  { trigger: "BEFORE_DUE", offsetDays: 1, channel: "WHATSAPP", template: T_LEMBRETE_WHATSAPP, phase: "LEMBRETE" },
];

const STEPS_VENCIMENTO: DefaultStep[] = [
  { trigger: "ON_DUE", offsetDays: 0, channel: "WHATSAPP", template: T_VENCIMENTO_WHATSAPP, phase: "VENCIMENTO" },
];

const STEPS_ATRASO: DefaultStep[] = [
  { trigger: "AFTER_DUE", offsetDays: 3, channel: "SMS", template: T_ATRASO_SMS, phase: "ATRASO" },
  { trigger: "AFTER_DUE", offsetDays: 7, channel: "WHATSAPP", template: T_ATRASO_WHATSAPP, phase: "ATRASO" },
  { trigger: "AFTER_DUE", offsetDays: 10, channel: "LIGACAO", template: "", phase: "ATRASO" },
  { trigger: "AFTER_DUE", offsetDays: 12, channel: "SMS", template: T_ATRASO_SMS, phase: "ATRASO" },
];

const STEPS_NEGATIVACAO: DefaultStep[] = [
  { trigger: "AFTER_DUE", offsetDays: 15, channel: "BOA_VISTA", template: "", phase: "NEGATIVACAO" },
];

const STEPS_COBRANCA_INTENSIVA: DefaultStep[] = [
  { trigger: "AFTER_DUE", offsetDays: 18, channel: "SMS", template: T_COBRANCA_SMS, phase: "COBRANCA_INTENSIVA" },
  { trigger: "AFTER_DUE", offsetDays: 20, channel: "WHATSAPP", template: T_COBRANCA_WHATSAPP, phase: "COBRANCA_INTENSIVA" },
  { trigger: "AFTER_DUE", offsetDays: 25, channel: "LIGACAO", template: "", phase: "COBRANCA_INTENSIVA" },
  { trigger: "AFTER_DUE", offsetDays: 30, channel: "SMS", template: T_COBRANCA_SMS, phase: "COBRANCA_INTENSIVA" },
  { trigger: "AFTER_DUE", offsetDays: 35, channel: "WHATSAPP", template: T_COBRANCA_WHATSAPP, phase: "COBRANCA_INTENSIVA" },
];

const STEPS_PROTESTO: DefaultStep[] = [
  { trigger: "AFTER_DUE", offsetDays: 45, channel: "CARTORIO", template: "", phase: "PROTESTO" },
];

const STEPS_POS_PROTESTO: DefaultStep[] = [
  { trigger: "AFTER_DUE", offsetDays: 50, channel: "SMS", template: T_POS_PROTESTO_SMS, phase: "POS_PROTESTO" },
  { trigger: "AFTER_DUE", offsetDays: 55, channel: "WHATSAPP", template: T_POS_PROTESTO_WHATSAPP, phase: "POS_PROTESTO" },
  { trigger: "AFTER_DUE", offsetDays: 65, channel: "LIGACAO", template: "", phase: "POS_PROTESTO" },
  { trigger: "AFTER_DUE", offsetDays: 75, channel: "SMS", template: T_POS_PROTESTO_SMS, phase: "POS_PROTESTO" },
  { trigger: "AFTER_DUE", offsetDays: 90, channel: "WHATSAPP", template: T_POS_PROTESTO_WHATSAPP, phase: "POS_PROTESTO" },
];

// ── Réguas por perfil ──

export const DEFAULT_DUNNING_RULES: DefaultDunningRule[] = [
  {
    name: "Régua — Bom Pagador",
    riskProfile: "BOM_PAGADOR",
    maxPhase: "ATRASO",
    steps: [...STEPS_LEMBRETE, ...STEPS_VENCIMENTO, ...STEPS_ATRASO],
  },
  {
    name: "Régua — Duvidoso",
    riskProfile: "DUVIDOSO",
    maxPhase: "COBRANCA_INTENSIVA",
    steps: [
      ...STEPS_LEMBRETE,
      ...STEPS_VENCIMENTO,
      ...STEPS_ATRASO,
      ...STEPS_NEGATIVACAO,
      ...STEPS_COBRANCA_INTENSIVA,
    ],
  },
  {
    name: "Régua — Mau Pagador",
    riskProfile: "MAU_PAGADOR",
    maxPhase: "POS_PROTESTO",
    steps: [
      ...STEPS_LEMBRETE,
      ...STEPS_VENCIMENTO,
      ...STEPS_ATRASO,
      ...STEPS_NEGATIVACAO,
      ...STEPS_COBRANCA_INTENSIVA,
      ...STEPS_PROTESTO,
      ...STEPS_POS_PROTESTO,
    ],
  },
];

export function createDefaultDunningRules(franqueadoraId: string) {
  return DEFAULT_DUNNING_RULES.map((rule) => ({
    name: rule.name,
    riskProfile: rule.riskProfile,
    maxPhase: rule.maxPhase,
    franqueadoraId,
    steps: {
      create: rule.steps.map((step) => ({
        trigger: step.trigger,
        offsetDays: step.offsetDays,
        channel: step.channel,
        template: step.template,
        phase: step.phase,
        enabled: true,
      })),
    },
  }));
}
