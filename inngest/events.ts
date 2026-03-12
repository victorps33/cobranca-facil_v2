import type { Channel } from "@prisma/client";

// --- Charge Events ---
type ChargeCreatedEvent = {
  data: {
    chargeId: string;
    customerId: string;
    amountCents: number;
    dueDate: string;
    franqueadoraId: string;
  };
};

type ChargePaidEvent = {
  data: {
    chargeId: string;
    customerId: string;
    amountPaidCents: number;
    franqueadoraId: string;
  };
};

type ChargeOverdueEvent = {
  data: {
    chargeId: string;
    customerId: string;
    daysPastDue: number;
    franqueadoraId: string;
  };
};

type ChargePartiallyPaidEvent = {
  data: {
    chargeId: string;
    customerId: string;
    amountPaidCents: number;
    franqueadoraId: string;
  };
};

type ChargeCanceledEvent = {
  data: {
    chargeId: string;
    customerId: string;
    franqueadoraId: string;
  };
};

type ChargeUpdatedEvent = {
  data: {
    chargeId: string;
    franqueadoraId: string;
  };
};

type ChargeBoletoGeneratedEvent = {
  data: {
    chargeId: string;
    boletoId: string;
    franqueadoraId: string;
  };
};

// --- Customer Events ---
type CustomerCreatedEvent = {
  data: {
    customerId: string;
    franqueadoraId: string;
  };
};

type CustomerUpdatedEvent = {
  data: {
    customerId: string;
    franqueadoraId: string;
  };
};

type CustomerDeletedEvent = {
  data: {
    customerId: string;
    franqueadoraId: string;
  };
};

// --- Message & Dunning Events ---
type InboundReceivedEvent = {
  data: {
    from: string;
    body: string;
    channel: Channel;
    providerMsgId: string;
    customerId?: string;
    conversationId?: string;
    messageId?: string;
    franqueadoraId: string;
  };
};

type MessageSentEvent = {
  data: {
    messageId: string;
    conversationId: string;
    chargeId?: string;
    channel: Channel;
    content: string;
    customerId: string;
    franqueadoraId: string;
  };
};

type MessageDeliveredEvent = {
  data: {
    providerMsgId: string;
    chargeId?: string;
    customerId?: string;
    franqueadoraId?: string;
  };
};

type MessageFailedEvent = {
  data: {
    providerMsgId: string;
    error: string;
    chargeId?: string;
    customerId?: string;
    franqueadoraId?: string;
  };
};

// --- AI Decision Events ---
type AICollectionDecidedEvent = {
  data: {
    chargeId: string;
    customerId: string;
    action: string;
    confidence: number;
    reasoning: string;
    franqueadoraId: string;
  };
};

type AIInboundDecidedEvent = {
  data: {
    conversationId: string;
    customerId: string;
    action: string;
    confidence: number;
    reasoning: string;
    franqueadoraId: string;
  };
};

type AIEscalationTriggeredEvent = {
  data: {
    conversationId?: string;
    customerId: string;
    chargeId?: string;
    reason: string;
    details?: string;
    franqueadoraId: string;
  };
};

// --- Integration Events ---
type OmieWebhookReceivedEvent = {
  data: {
    topic: string;
    payload: Record<string, unknown>;
    franqueadoraId: string;
  };
};

// --- ERP Integration Events ---
type ChargeInvoiceRequestedEvent = {
  data: {
    chargeId: string;
    franqueadoraId: string;
    customerId: string;
  };
};

type ChargeInvoiceIssuedEvent = {
  data: {
    chargeId: string;
    invoiceNumber: string;
    invoicePdfUrl?: string;
    franqueadoraId: string;
  };
};

type ERPSyncCompletedEvent = {
  data: {
    franqueadoraId: string;
    provider: string;
    customersCreated: number;
    customersUpdated: number;
    chargesCreated: number;
    chargesUpdated: number;
    errors: number;
  };
};

// --- Events Map ---
export type Events = {
  "charge/created": ChargeCreatedEvent;
  "charge/paid": ChargePaidEvent;
  "charge/overdue": ChargeOverdueEvent;
  "charge/partially-paid": ChargePartiallyPaidEvent;
  "charge/canceled": ChargeCanceledEvent;
  "charge/updated": ChargeUpdatedEvent;
  "charge/boleto-generated": ChargeBoletoGeneratedEvent;
  "customer/created": CustomerCreatedEvent;
  "customer/updated": CustomerUpdatedEvent;
  "customer/deleted": CustomerDeletedEvent;
  "inbound/received": InboundReceivedEvent;
  "message/sent": MessageSentEvent;
  "message/delivered": MessageDeliveredEvent;
  "message/failed": MessageFailedEvent;
  "ai/collection-decided": AICollectionDecidedEvent;
  "ai/inbound-decided": AIInboundDecidedEvent;
  "ai/escalation-triggered": AIEscalationTriggeredEvent;
  "integration/omie-webhook-received": OmieWebhookReceivedEvent;
  // Engagement & Intelligence events
  "engagement/status.received": EngagementStatusReceivedEvent;
  "engagement/payment.received": EngagementPaymentReceivedEvent;
  "intelligence/stats.refresh": IntelligenceRefreshEvent;
  "intelligence/profiles.refresh": IntelligenceRefreshEvent;
  "intelligence/variants.evaluate": IntelligenceRefreshEvent;
  // Negotiation events (emitted by dunning-saga)
  "negotiation/offered": NegotiationEvent;
  "negotiation/promise-made": NegotiationEvent;
  "negotiation/callback-scheduled": NegotiationEvent;
  // ERP integration events
  "charge/invoice-requested": ChargeInvoiceRequestedEvent;
  "charge/invoice-issued": ChargeInvoiceIssuedEvent;
  "integration/erp-sync-completed": ERPSyncCompletedEvent;
};

// --- Engagement & Intelligence Events ---
type EngagementStatusReceivedEvent = {
  data: {
    providerMsgId: string;
    status: "delivered" | "read" | "failed" | "undelivered";
    messageId?: string;
    customerId?: string;
    stepId?: string;
    variantId?: string;
    channel?: string;
    franqueadoraId?: string;
  };
};

type EngagementPaymentReceivedEvent = {
  data: {
    chargeId: string;
    customerId: string;
    franqueadoraId: string;
    amount: number;
  };
};

type IntelligenceRefreshEvent = {
  data: {
    franqueadoraId?: string;
  };
};

// --- Negotiation Events ---
type NegotiationEvent = {
  data: {
    chargeId: string;
    customerId: string;
    franqueadoraId: string;
    details: string;
  };
};
