import type {
  Channel,
  AgentAction,
  EscalationReason,
  MessageSender,
  ConversationStatus,
  MessageQueueStatus,
} from "@prisma/client";

export interface AIDecisionMetadata {
  promiseDate?: string;
  installments?: number;
  callbackDate?: string;
  chargeId?: string;
}

export interface AIDecision {
  action: AgentAction;
  message: string;
  confidence: number;
  reasoning: string;
  escalationReason?: EscalationReason;
  metadata?: AIDecisionMetadata;
}

export interface NegotiationRuleTier {
  minCents: number;
  maxCents: number | null;
  maxInstallments: number;
  interestRate: number;
}

export interface NegotiationConfig {
  maxInstallments: number;
  monthlyInterestRate: number;
  maxCashDiscount: number;
  minInstallmentCents: number;
  maxFirstInstallmentDays: number;
  tiers: NegotiationRuleTier[];
}

export interface BoletoInfo {
  chargeId: string;
  linhaDigitavel: string;
  publicUrl: string;
}

export interface PaymentHistory {
  totalPaid: number;
  totalCharges: number;
  averageDaysLate: number;
  defaultRate: number;
}

export interface PromiseHistory {
  total: number;
  kept: number;
  broken: number;
}

export interface RiskScore {
  score: number;
  label: "BAIXO" | "MEDIO" | "ALTO" | "CRITICO";
}

export interface CollectionContext {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  charge: {
    id: string;
    description: string;
    amountCents: number;
    dueDate: Date;
    status: string;
    daysOverdue: number;
  };
  channel: Channel;
  recentMessages: {
    sender: MessageSender;
    content: string;
    createdAt: Date;
  }[];
  recentDecisions: {
    action: AgentAction;
    reasoning: string;
    createdAt: Date;
  }[];
  recentNotifications: {
    channel: Channel;
    status: string;
    sentAt: Date | null;
    renderedMessage: string;
  }[];
  openTasks: {
    title: string;
    status: string;
    priority: string;
  }[];
  healthStatus?: string;
  franqueadoraId: string;
}

export interface InboundContext {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  conversationId: string;
  channel: Channel;
  inboundMessage: string;
  recentMessages: {
    sender: MessageSender;
    content: string;
    createdAt: Date;
  }[];
  recentDecisions: {
    action: AgentAction;
    reasoning: string;
    createdAt: Date;
  }[];
  openCharges: {
    id: string;
    description: string;
    amountCents: number;
    dueDate: Date;
    status: string;
  }[];
  openTasks: {
    title: string;
    status: string;
    priority: string;
  }[];
  franqueadoraId: string;
  boletos: BoletoInfo[];
  paymentHistory: PaymentHistory;
  promiseHistory: PromiseHistory;
  riskScore: RiskScore;
  negotiationConfig: NegotiationConfig;
}

export interface DispatchResult {
  success: boolean;
  providerMsgId?: string;
  error?: string;
}

export interface WorkingHours {
  start: number;
  end: number;
  timezone: string;
}
