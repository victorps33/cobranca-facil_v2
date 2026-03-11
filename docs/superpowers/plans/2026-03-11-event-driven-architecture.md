# Event-Driven Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Cobrança Fácil from cron-driven/direct-call architecture to event-driven using Inngest as the event bus.

**Architecture:** API routes and webhooks emit domain events via `inngest.send()`. Inngest routes events to sagas (multi-step workflows with step functions) and reactive functions (simple side effects). Cron jobs are replaced by Inngest scheduled functions. The `MessageQueue` table is eliminated — Inngest manages queuing, retries, and delivery.

**Tech Stack:** Inngest, Next.js 14 (App Router), Prisma, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-11-event-driven-architecture-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `inngest/client.ts` | Inngest client instance with type-safe event schemas |
| `inngest/events.ts` | TypeScript type definitions for all domain events |
| `inngest/index.ts` | Re-exports client + array of all functions for serve() |
| `inngest/sagas/charge-lifecycle.ts` | Saga: boleto generation → sleep until due → emit overdue |
| `inngest/sagas/dunning-saga.ts` | Saga: iterate dunning steps with AI decisions and dispatch |
| `inngest/sagas/inbound-processing.ts` | Saga: AI response to inbound messages with safety checks |
| `inngest/sagas/omie-sync.ts` | Saga: process Omie webhook data and emit downstream events |
| `inngest/functions/update-risk-score.ts` | Reactor: recalculate risk score on charge status changes |
| `inngest/functions/log-interaction.ts` | Reactor: create InteractionLog entries |
| `inngest/functions/handle-escalation.ts` | Reactor: escalate conversation to human agent |
| `inngest/functions/handle-delivery-status.ts` | Reactor: update message status from provider webhooks |
| `inngest/functions/notify-payment-received.ts` | Reactor: handle charge paid side effects |
| `inngest/functions/log-agent-decision.ts` | Reactor: persist AgentDecisionLog |
| `inngest/scheduled/check-pending-charges.ts` | Scheduled: daily check for overdue charges |
| `inngest/scheduled/recalculate-risk-scores.ts` | Scheduled: weekly batch risk recalculation |
| `app/api/inngest/route.ts` | Inngest serve() endpoint |

### Modified Files
| File | Change |
|------|--------|
| `package.json` | Add `inngest` dependency |
| `middleware.ts:12` | Add `api/inngest` to matcher exclusion |
| `app/api/charges/route.ts:66-106` | POST: add `inngest.send("charge/created")` after create |
| `app/api/charges/[id]/route.ts:23-67` | PATCH/DELETE: add event emission |
| `app/api/customers/route.ts:85-123` | POST: add `inngest.send("customer/created")` |
| `app/api/webhooks/twilio/route.ts:5-232` | Replace fire-and-forget with `inngest.send("inbound/received")` |
| `app/api/webhooks/twilio/status/route.ts:4-43` | Replace direct DB update with event emission |
| `app/api/webhooks/customerio/route.ts:6-134` | Replace inline processing with event emission |
| `app/api/integrations/omie/webhook/route.ts:11-37` | Replace processOmieWebhook with event emission |
| `app/api/inbox/conversations/[id]/messages/route.ts:61-164` | Replace MessageQueue + dispatchMessage with event emission |
| `lib/agent/dispatch.ts` | Remove queue-dependent logic, keep provider dispatch functions |
| `vercel.json` | Remove crons section |
| `prisma/schema.prisma:421-428,607-633` | Remove MessageQueue model and MessageQueueStatus enum |

### Removed Files
| File | Reason |
|------|--------|
| `app/api/cron/all/route.ts` | Replaced by Inngest scheduled functions |
| `app/api/cron/dunning-run/route.ts` | Replaced by dunning-saga |
| `app/api/cron/message-dispatch/route.ts` | Replaced by saga dispatch steps |
| `app/api/cron/retry-failed/route.ts` | Replaced by Inngest retry mechanism |
| `app/api/agent/process-inbound/route.ts` | Replaced by inbound-processing saga |
| `lib/agent/orchestrator.ts` | Logic migrated to sagas |

---

## Chunk 1: Foundation

### Task 1: Install Inngest and create client

**Files:**
- Modify: `package.json`
- Create: `inngest/client.ts`

- [ ] **Step 1: Install inngest**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
npm install inngest
```

Expected: `inngest` added to `dependencies` in package.json

- [ ] **Step 2: Create Inngest client**

Create `inngest/client.ts`:

```typescript
import { EventSchemas, Inngest } from "inngest";
import type { Events } from "./events";

export const inngest = new Inngest({
  id: "cobranca-facil",
  schemas: new EventSchemas().fromRecord<Events>(),
});
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json inngest/client.ts
git commit -m "feat: install inngest and create typed client"
```

---

### Task 2: Define domain event types

**Files:**
- Create: `inngest/events.ts`

This is the type-safety backbone. Every `inngest.send()` and `createFunction()` will be validated against these types.

- [ ] **Step 1: Create events.ts with all domain event types**

Create `inngest/events.ts`:

```typescript
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
};
```

**Note:** This covers the 18 most critical events. Additional events (task/*, conversation/*, config/*, negotiation/*) can be added incrementally as their producers/consumers are implemented. Start with the core flow.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
npx tsc --noEmit inngest/events.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add inngest/events.ts
git commit -m "feat: define domain event types for Inngest"
```

---

### Task 3: Create serve endpoint and update middleware

**Files:**
- Create: `inngest/index.ts`
- Create: `app/api/inngest/route.ts`
- Modify: `middleware.ts:12`

- [ ] **Step 1: Create inngest/index.ts (empty functions array for now)**

Create `inngest/index.ts`:

```typescript
export { inngest } from "./client";

// Functions will be added as they are implemented
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const allFunctions: any[] = [];
```

- [ ] **Step 2: Create the Inngest serve endpoint**

Create `app/api/inngest/route.ts`:

```typescript
import { serve } from "inngest/next";
import { inngest, allFunctions } from "@/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: allFunctions,
});
```

- [ ] **Step 3: Update middleware to exclude /api/inngest**

In `middleware.ts`, update the matcher regex to add `api/inngest` to the exclusion list:

```typescript
// Before:
"/((?!api/auth|api/cron|api/webhooks|api/integrations|_next/static|..."

// After:
"/((?!api/auth|api/cron|api/inngest|api/webhooks|api/integrations|_next/static|..."
```

Add `api/inngest|` after `api/cron|`.

- [ ] **Step 4: Verify dev server starts**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
npm run dev
```

Visit `http://localhost:3000/api/inngest` — should return Inngest introspection JSON.

- [ ] **Step 5: Commit**

```bash
git add inngest/index.ts app/api/inngest/route.ts middleware.ts
git commit -m "feat: add Inngest serve endpoint and middleware exclusion"
```

---

## Chunk 2: Reactive Functions

### Task 4: Implement update-risk-score function

**Files:**
- Create: `inngest/functions/update-risk-score.ts`
- Modify: `inngest/index.ts`

- [ ] **Step 1: Create update-risk-score function**

Create `inngest/functions/update-risk-score.ts`:

```typescript
import { inngest } from "../client";
import { calculateRiskForCustomer } from "@/lib/risk-score";
import { prisma } from "@/lib/prisma";

export const updateRiskScore = inngest.createFunction(
  {
    id: "update-risk-score",
    retries: 3,
  },
  [
    { event: "charge/paid" },
    { event: "charge/overdue" },
    { event: "charge/partially-paid" },
  ],
  async ({ event }) => {
    const { customerId } = event.data;

    const result = await calculateRiskForCustomer(customerId);

    await prisma.franchiseeRiskScore.upsert({
      where: { customerId },
      create: {
        customerId,
        defaultRate: result.defaultRate,
        avgDaysLate: result.avgDaysLate,
        totalOutstanding: result.totalOutstanding,
        riskProfile: result.riskProfile,
      },
      update: {
        defaultRate: result.defaultRate,
        avgDaysLate: result.avgDaysLate,
        totalOutstanding: result.totalOutstanding,
        riskProfile: result.riskProfile,
      },
    });

    return { customerId, riskProfile: result.riskProfile };
  }
);
```

- [ ] **Step 2: Register in inngest/index.ts**

Add to `inngest/index.ts`:

```typescript
export { inngest } from "./client";
import { updateRiskScore } from "./functions/update-risk-score";

export const allFunctions = [
  updateRiskScore,
];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit inngest/functions/update-risk-score.ts
```

- [ ] **Step 4: Commit**

```bash
git add inngest/functions/update-risk-score.ts inngest/index.ts
git commit -m "feat: add update-risk-score reactive function"
```

---

### Task 5: Implement log-interaction function

**Files:**
- Create: `inngest/functions/log-interaction.ts`
- Modify: `inngest/index.ts`

- [ ] **Step 1: Create log-interaction function**

Create `inngest/functions/log-interaction.ts`:

```typescript
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import type { InteractionType } from "@prisma/client";

// Map Channel to InteractionType (they share EMAIL, WHATSAPP, SMS)
function channelToInteractionType(channel: string): InteractionType {
  const map: Record<string, InteractionType> = {
    EMAIL: "EMAIL",
    WHATSAPP: "WHATSAPP",
    SMS: "SMS",
    LIGACAO: "TELEFONE",
  };
  return map[channel] || "SMS";
}

export const logInteraction = inngest.createFunction(
  {
    id: "log-interaction",
    retries: 3,
  },
  [
    { event: "message/sent" },
    { event: "inbound/received" },
  ],
  async ({ event }) => {
    const isInbound = event.name === "inbound/received";
    const customerId = event.data.customerId;

    if (!customerId) {
      return { logged: false, reason: "no customerId" };
    }

    // Find a system user to attribute the log to
    const systemUser = await prisma.user.findFirst({
      where: { role: "ADMINISTRADOR" },
      select: { id: true },
    });

    if (!systemUser) {
      return { logged: false, reason: "no system user found" };
    }

    await prisma.interactionLog.create({
      data: {
        customerId,
        chargeId: "chargeId" in event.data ? (event.data as { chargeId?: string }).chargeId : undefined,
        type: channelToInteractionType(event.data.channel),
        direction: isInbound ? "INBOUND" : "OUTBOUND",
        content: isInbound
          ? (event.data as { body: string }).body
          : (event.data as { content: string }).content,
        createdById: systemUser.id,
      },
    });

    return { logged: true };
  }
);
```

- [ ] **Step 2: Register in inngest/index.ts**

Add `logInteraction` to the imports and `allFunctions` array.

- [ ] **Step 3: Commit**

```bash
git add inngest/functions/log-interaction.ts inngest/index.ts
git commit -m "feat: add log-interaction reactive function"
```

---

### Task 6: Implement handle-escalation function

**Files:**
- Create: `inngest/functions/handle-escalation.ts`
- Modify: `inngest/index.ts`

- [ ] **Step 1: Create handle-escalation function**

Create `inngest/functions/handle-escalation.ts`:

```typescript
import { inngest } from "../client";
import { executeEscalation, type EscalationReason } from "@/lib/agent/escalation";

export const handleEscalation = inngest.createFunction(
  {
    id: "handle-escalation",
    retries: 5,
  },
  { event: "ai/escalation-triggered" },
  async ({ event }) => {
    const { conversationId, customerId, reason, details, franqueadoraId } = event.data;

    if (conversationId) {
      await executeEscalation(
        conversationId,
        customerId,
        reason as EscalationReason,
        details || "",
        franqueadoraId
      );
    }

    return { escalated: true, conversationId, reason };
  }
);
```

- [ ] **Step 2: Register in inngest/index.ts**

Add `handleEscalation` to imports and `allFunctions`.

- [ ] **Step 3: Commit**

```bash
git add inngest/functions/handle-escalation.ts inngest/index.ts
git commit -m "feat: add handle-escalation reactive function"
```

---

### Task 7: Implement handle-delivery-status function

**Files:**
- Create: `inngest/functions/handle-delivery-status.ts`
- Modify: `inngest/index.ts`

- [ ] **Step 1: Create handle-delivery-status function**

Create `inngest/functions/handle-delivery-status.ts`:

```typescript
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const handleDeliveryStatus = inngest.createFunction(
  {
    id: "handle-delivery-status",
    retries: 3,
  },
  [
    { event: "message/delivered" },
    { event: "message/failed" },
  ],
  async ({ event }) => {
    const { providerMsgId } = event.data;
    const isDelivered = event.name === "message/delivered";

    // Find message by provider ID
    const message = await prisma.message.findFirst({
      where: { externalId: providerMsgId },
      include: { conversation: true },
    });

    if (!message) {
      return { skipped: true, reason: "message not found" };
    }

    // Note: Message model has no `status` field — use `metadata` JSON to track delivery
    if (isDelivered) {
      await prisma.message.update({
        where: { id: message.id },
        data: { metadata: JSON.stringify({ deliveryStatus: "DELIVERED", deliveredAt: new Date().toISOString() }) },
      });
    } else {
      const error = (event.data as { error: string }).error;
      await prisma.message.update({
        where: { id: message.id },
        data: { metadata: JSON.stringify({ deliveryStatus: "FAILED", error, failedAt: new Date().toISOString() }) },
      });

      // Create collection task for failed delivery review
      // Find system user for createdById (required field)
      const systemUser = await prisma.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });

      if (systemUser && message.conversation?.customerId) {
        await prisma.collectionTask.create({
          data: {
            title: `[FALHA ENVIO] Mensagem para conversa ${message.conversationId}`,
            description: `Entrega falhou: ${error}`,
            priority: "ALTA",
            status: "PENDENTE",
            customerId: message.conversation.customerId,
            createdById: systemUser.id,
          },
        });
      }
    }

    return { updated: true, messageId: message.id, status: isDelivered ? "DELIVERED" : "FAILED" };
  }
);
```

- [ ] **Step 2: Register in inngest/index.ts**

Add `handleDeliveryStatus` to imports and `allFunctions`.

- [ ] **Step 3: Commit**

```bash
git add inngest/functions/handle-delivery-status.ts inngest/index.ts
git commit -m "feat: add handle-delivery-status reactive function"
```

---

### Task 8: Implement notify-payment-received function

**Files:**
- Create: `inngest/functions/notify-payment-received.ts`
- Modify: `inngest/index.ts`

- [ ] **Step 1: Create notify-payment-received function**

Create `inngest/functions/notify-payment-received.ts`:

```typescript
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const notifyPaymentReceived = inngest.createFunction(
  {
    id: "notify-payment-received",
    retries: 3,
  },
  { event: "charge/paid" },
  async ({ event }) => {
    const { chargeId, customerId } = event.data;

    // Update charge status if not already PAID
    const charge = await prisma.charge.findUnique({ where: { id: chargeId } });
    if (charge && charge.status !== "PAID") {
      await prisma.charge.update({
        where: { id: chargeId },
        data: { status: "PAID", paidAt: new Date() },
      });
    }

    return { chargeId, customerId, processed: true };
  }
);
```

- [ ] **Step 2: Register in inngest/index.ts**

Add `notifyPaymentReceived` to imports and `allFunctions`.

- [ ] **Step 3: Commit**

```bash
git add inngest/functions/notify-payment-received.ts inngest/index.ts
git commit -m "feat: add notify-payment-received reactive function"
```

---

### Task 9: Implement log-agent-decision function

**Files:**
- Create: `inngest/functions/log-agent-decision.ts`
- Modify: `inngest/index.ts`

- [ ] **Step 1: Create log-agent-decision function**

Create `inngest/functions/log-agent-decision.ts`:

```typescript
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const logAgentDecision = inngest.createFunction(
  {
    id: "log-agent-decision",
    retries: 3,
  },
  [
    { event: "ai/collection-decided" },
    { event: "ai/inbound-decided" },
  ],
  async ({ event }) => {
    const { action, confidence, reasoning, franqueadoraId } = event.data;

    await prisma.agentDecisionLog.create({
      data: {
        chargeId: "chargeId" in event.data ? event.data.chargeId : undefined,
        conversationId: "conversationId" in event.data ? event.data.conversationId : undefined,
        customerId: event.data.customerId,
        action,
        confidence,
        reasoning,
        inputContext: JSON.stringify(event.data),
        franqueadoraId,
        executedAt: new Date(),
      },
    });

    return { logged: true, action };
  }
);
```

- [ ] **Step 2: Register in inngest/index.ts — final state with all 6 reactive functions**

Update `inngest/index.ts` to its final state:

```typescript
export { inngest } from "./client";

import { updateRiskScore } from "./functions/update-risk-score";
import { logInteraction } from "./functions/log-interaction";
import { handleEscalation } from "./functions/handle-escalation";
import { handleDeliveryStatus } from "./functions/handle-delivery-status";
import { notifyPaymentReceived } from "./functions/notify-payment-received";
import { logAgentDecision } from "./functions/log-agent-decision";

export const allFunctions = [
  updateRiskScore,
  logInteraction,
  handleEscalation,
  handleDeliveryStatus,
  notifyPaymentReceived,
  logAgentDecision,
];
```

- [ ] **Step 3: Commit**

```bash
git add inngest/functions/log-agent-decision.ts inngest/index.ts
git commit -m "feat: add log-agent-decision reactive function (all 6 reactors complete)"
```

---

### Task 10: Implement dispatch-on-send function

**Files:**
- Create: `inngest/functions/dispatch-on-send.ts`
- Modify: `inngest/index.ts`

This function is critical: it dispatches messages to providers (Twilio/Customer.io) when a `message/sent` event is emitted from the inbox route. Without it, human-sent messages would be logged but never actually delivered.

- [ ] **Step 1: Create dispatch-on-send function**

Create `inngest/functions/dispatch-on-send.ts`:

```typescript
import { inngest } from "../client";
import { dispatchMessage } from "@/lib/agent/dispatch";

export const dispatchOnSend = inngest.createFunction(
  {
    id: "dispatch-on-send",
    retries: 3,
  },
  { event: "message/sent" },
  async ({ event }) => {
    const { messageId, channel, content, customerId, conversationId, franqueadoraId } = event.data;

    const result = await dispatchMessage({
      channel,
      content,
      customerId,
      conversationId,
      messageId,
      franqueadoraId,
    });

    if (!result.success) {
      throw new Error(`Dispatch failed: ${result.error}`);
    }

    return { dispatched: true, providerMsgId: result.providerMsgId };
  }
);
```

- [ ] **Step 2: Register in inngest/index.ts**

Add `dispatchOnSend` to imports and `allFunctions`.

- [ ] **Step 3: Commit**

```bash
git add inngest/functions/dispatch-on-send.ts inngest/index.ts
git commit -m "feat: add dispatch-on-send function (delivers human-sent messages)"
```

---

## Chunk 3: Scheduled Functions

### Task 11: Implement check-pending-charges scheduled function

**Files:**
- Create: `inngest/scheduled/check-pending-charges.ts`
- Modify: `inngest/index.ts`

- [ ] **Step 1: Create check-pending-charges function**

Create `inngest/scheduled/check-pending-charges.ts`:

```typescript
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const checkPendingCharges = inngest.createFunction(
  {
    id: "check-pending-charges",
    retries: 3,
  },
  { cron: "0 8 * * *" },
  async ({ step }) => {
    const overdueCharges = await step.run("find-overdue-charges", async () => {
      const now = new Date();
      return prisma.charge.findMany({
        where: {
          status: "PENDING",
          dueDate: { lt: now },
        },
        select: {
          id: true,
          customerId: true,
          dueDate: true,
          customer: { select: { franqueadoraId: true } },
        },
      });
    });

    if (overdueCharges.length === 0) {
      return { processed: 0 };
    }

    // Mark as OVERDUE
    await step.run("mark-overdue", async () => {
      await prisma.charge.updateMany({
        where: {
          id: { in: overdueCharges.map((c) => c.id) },
          status: "PENDING",
        },
        data: { status: "OVERDUE" },
      });
    });

    // Emit charge/overdue event for each
    await step.sendEvent(
      "emit-overdue-events",
      overdueCharges.map((charge) => ({
        name: "charge/overdue" as const,
        data: {
          chargeId: charge.id,
          customerId: charge.customerId,
          daysPastDue: Math.floor(
            (Date.now() - new Date(charge.dueDate).getTime()) / (1000 * 60 * 60 * 24)
          ),
          franqueadoraId: charge.customer.franqueadoraId,
        },
      }))
    );

    return { processed: overdueCharges.length };
  }
);
```

- [ ] **Step 2: Register in inngest/index.ts**

Add `checkPendingCharges` to imports and `allFunctions`.

- [ ] **Step 3: Commit**

```bash
git add inngest/scheduled/check-pending-charges.ts inngest/index.ts
git commit -m "feat: add check-pending-charges scheduled function"
```

---

### Task 12: Implement recalculate-risk-scores scheduled function

**Files:**
- Create: `inngest/scheduled/recalculate-risk-scores.ts`
- Modify: `inngest/index.ts`

- [ ] **Step 1: Create recalculate-risk-scores function**

Create `inngest/scheduled/recalculate-risk-scores.ts`:

```typescript
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { recalculateAllRiskScores } from "@/lib/risk-score";

export const recalculateRiskScores = inngest.createFunction(
  {
    id: "recalculate-risk-scores",
    retries: 3,
  },
  { cron: "0 2 * * 1" },
  async ({ step }) => {
    const franqueadoras = await step.run("get-franqueadoras", async () => {
      return prisma.franqueadora.findMany({
        select: { id: true },
      });
    });

    const results = await step.run("recalculate-all", async () => {
      return recalculateAllRiskScores(franqueadoras.map((f) => f.id));
    });

    return { recalculated: results.length };
  }
);
```

- [ ] **Step 2: Register in inngest/index.ts**

Add `recalculateRiskScores` to imports and `allFunctions`.

- [ ] **Step 3: Commit**

```bash
git add inngest/scheduled/recalculate-risk-scores.ts inngest/index.ts
git commit -m "feat: add recalculate-risk-scores scheduled function"
```

---

## Chunk 4: Sagas

### Task 13: Implement charge-lifecycle saga

**Files:**
- Create: `inngest/sagas/charge-lifecycle.ts`
- Modify: `inngest/index.ts`

- [ ] **Step 1: Create charge-lifecycle saga**

Create `inngest/sagas/charge-lifecycle.ts`:

```typescript
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const chargeLifecycle = inngest.createFunction(
  {
    id: "charge-lifecycle",
    retries: 3,
  },
  { event: "charge/created" },
  async ({ event, step }) => {
    const { chargeId, dueDate, customerId, franqueadoraId } = event.data;

    // Step 1: Generate boleto
    await step.run("generate-boleto", async () => {
      const charge = await prisma.charge.findUnique({
        where: { id: chargeId },
        include: { boleto: true },
      });

      if (charge && !charge.boleto) {
        // Generate simulated boleto
        const linhaDigitavel = `23793.38128 ${Date.now()} ${charge.amountCents}`;
        await prisma.boleto.create({
          data: {
            chargeId,
            linhaDigitavel,
            barcodeValue: linhaDigitavel.replace(/[.\s]/g, ""),
            publicUrl: `https://boleto.example.com/${chargeId}`,
          },
        });
      }
    });

    // Step 2: Sleep until due date
    await step.sleepUntil("wait-due-date", new Date(dueDate));

    // Step 3: Check if already paid
    const charge = await step.run("check-payment", async () => {
      return prisma.charge.findUnique({
        where: { id: chargeId },
        select: { status: true },
      });
    });

    if (!charge || charge.status === "PAID" || charge.status === "CANCELED") {
      return { chargeId, result: "already-resolved", status: charge?.status };
    }

    // Step 4: Emit overdue event
    await step.sendEvent("emit-overdue", {
      name: "charge/overdue",
      data: {
        chargeId,
        customerId,
        daysPastDue: 0,
        franqueadoraId,
      },
    });

    return { chargeId, result: "overdue-emitted" };
  }
);
```

- [ ] **Step 2: Register in inngest/index.ts**

Add `chargeLifecycle` to imports and `allFunctions`.

- [ ] **Step 3: Commit**

```bash
git add inngest/sagas/charge-lifecycle.ts inngest/index.ts
git commit -m "feat: add charge-lifecycle saga"
```

---

### Task 14: Implement dunning-saga

**Files:**
- Create: `inngest/sagas/dunning-saga.ts`
- Modify: `inngest/index.ts`

This is the most complex saga. It replaces `processScheduledDunning()` from `lib/agent/orchestrator.ts`.

- [ ] **Step 1: Create dunning-saga**

Create `inngest/sagas/dunning-saga.ts`:

```typescript
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { decideCollectionAction } from "@/lib/agent/ai";
import { buildCollectionContext } from "@/lib/agent/context-builder";
import { dispatchMessage } from "@/lib/agent/dispatch";

export const dunningSaga = inngest.createFunction(
  {
    id: "dunning-saga",
    retries: 3,
    onFailure: async ({ event, error }) => {
      const chargeId = event.data.event.data.chargeId;
      const { prisma: p } = await import("@/lib/prisma");
      // Find system user for createdById (required field)
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (!systemUser) return;
      await p.collectionTask.create({
        data: {
          title: `[FALHA DUNNING] Cobrança ${chargeId}`,
          description: `Saga falhou após retries: ${error.message}`,
          priority: "CRITICA",
          status: "PENDENTE",
          customerId: event.data.event.data.customerId,
          createdById: systemUser.id,
        },
      });
    },
  },
  { event: "charge/overdue" },
  async ({ event, step }) => {
    const { chargeId, customerId, franqueadoraId } = event.data;

    // Step 1: Get applicable dunning rule and steps
    const dunningConfig = await step.run("get-dunning-rule", async () => {
      // Get customer risk profile
      const riskScore = await prisma.franchiseeRiskScore.findUnique({
        where: { customerId },
      });
      const riskProfile = riskScore?.riskProfile || "BOM_PAGADOR";

      // Find matching dunning rule
      const rule = await prisma.dunningRule.findFirst({
        where: {
          franqueadoraId,
          riskProfile,
          active: true,
        },
        include: {
          steps: {
            where: { enabled: true },
            orderBy: { offsetDays: "asc" },
          },
        },
      });

      return rule;
    });

    if (!dunningConfig || dunningConfig.steps.length === 0) {
      return { chargeId, result: "no-dunning-rule" };
    }

    // Step 2: Get agent config
    const agentConfig = await step.run("get-agent-config", async () => {
      return prisma.agentConfig.findFirst({
        where: { franqueadoraId, enabled: true },
      });
    });

    if (!agentConfig) {
      return { chargeId, result: "agent-disabled" };
    }

    // Step 3: Execute each dunning step
    for (const dunningStep of dunningConfig.steps) {
      // Wait for the step's offset (days after overdue)
      if (dunningStep.offsetDays > 0) {
        await step.sleep(`wait-step-${dunningStep.id}`, `${dunningStep.offsetDays}d`);
      }

      // Check if paid while waiting
      const currentCharge = await step.run(`check-paid-${dunningStep.id}`, async () => {
        return prisma.charge.findUnique({
          where: { id: chargeId },
          select: { status: true },
        });
      });

      if (!currentCharge || currentCharge.status === "PAID" || currentCharge.status === "CANCELED") {
        return { chargeId, result: "resolved-during-dunning", step: dunningStep.id };
      }

      // Build context and get AI decision
      const decision = await step.run(`ai-decide-${dunningStep.id}`, async () => {
        const ctx = await buildCollectionContext(chargeId, dunningStep.channel);
        if (!ctx) return null;
        return decideCollectionAction(ctx);
      });

      if (!decision) {
        continue; // AI unavailable, skip this step
      }

      // Log the decision
      await step.sendEvent(`log-decision-${dunningStep.id}`, {
        name: "ai/collection-decided",
        data: {
          chargeId,
          customerId,
          action: decision.action,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          franqueadoraId,
        },
      });

      // Execute based on decision
      if (decision.action === "SKIP") {
        continue;
      }

      // Handle negotiation-related actions
      if (decision.action === "NEGOTIATE" || decision.action === "MARK_PROMISE" || decision.action === "SCHEDULE_CALLBACK") {
        await step.sendEvent(`negotiation-${dunningStep.id}`, {
          name: decision.action === "NEGOTIATE" ? "negotiation/offered" as const
            : decision.action === "MARK_PROMISE" ? "negotiation/promise-made" as const
            : "negotiation/callback-scheduled" as const,
          data: {
            chargeId,
            customerId,
            franqueadoraId,
            details: decision.reasoning,
          },
        });
        // Still dispatch the message if one was generated
        if (!decision.message) continue;
      }

      if (decision.action === "ESCALATE_HUMAN") {
        await step.sendEvent(`escalate-${dunningStep.id}`, {
          name: "ai/escalation-triggered",
          data: {
            customerId,
            chargeId,
            reason: decision.escalationReason || "AI_ESCALATION",
            details: decision.reasoning,
            franqueadoraId,
          },
        });
        return { chargeId, result: "escalated", step: dunningStep.id };
      }

      if (decision.action === "SEND_COLLECTION" && decision.message) {
        // Dispatch the message
        const dispatchResult = await step.run(`dispatch-${dunningStep.id}`, async () => {
          // Find or create conversation
          let conversation = await prisma.conversation.findFirst({
            where: { customerId, channel: dunningStep.channel, status: { not: "RESOLVIDA" } },
          });

          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: {
                customerId,
                channel: dunningStep.channel,
                status: "ABERTA",
                franqueadoraId,
              },
            });
          }

          // Create message record
          const message = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              sender: "AI",
              content: decision.message!,
              contentType: "text",
              channel: dunningStep.channel,
            },
          });

          // Dispatch via provider
          return dispatchMessage({
            channel: dunningStep.channel,
            content: decision.message!,
            customerId,
            conversationId: conversation.id,
            messageId: message.id,
            franqueadoraId,
          });
        });

        if (!dispatchResult.success) {
          // Dispatch failed — Inngest will retry the step
          throw new Error(`Dispatch failed: ${dispatchResult.error}`);
        }

        // Wait for delivery confirmation (optional, with timeout)
        const delivery = await step.waitForEvent(`delivery-${dunningStep.id}`, {
          event: "message/delivered",
          timeout: "24h",
          if: `async.data.providerMsgId == '${dispatchResult.providerMsgId}'`,
        });

        if (!delivery) {
          // Delivery not confirmed within 24h — continue to next step
          continue;
        }
      }
    }

    return { chargeId, result: "dunning-complete" };
  }
);
```

**Important:** The `dispatchMessage` function in `lib/agent/dispatch.ts` needs to be refactored (Task 17) to accept a plain object instead of a MessageQueue item. For now, create the saga with the expected interface — it will compile after the refactor.

- [ ] **Step 2: Register in inngest/index.ts**

Add `dunningSaga` to imports and `allFunctions`.

- [ ] **Step 3: Commit**

```bash
git add inngest/sagas/dunning-saga.ts inngest/index.ts
git commit -m "feat: add dunning-saga (replaces processScheduledDunning)"
```

---

### Task 15: Implement inbound-processing saga

**Files:**
- Create: `inngest/sagas/inbound-processing.ts`
- Modify: `inngest/index.ts`

This replaces `processInboundMessage()` from `lib/agent/orchestrator.ts`.

- [ ] **Step 1: Create inbound-processing saga**

Create `inngest/sagas/inbound-processing.ts`:

```typescript
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { decideInboundResponse } from "@/lib/agent/ai";
import { buildInboundContext } from "@/lib/agent/context-builder";
import { shouldForceEscalate, checkConsecutiveFailures } from "@/lib/agent/escalation";
import { dispatchMessage } from "@/lib/agent/dispatch";

export const inboundProcessing = inngest.createFunction(
  {
    id: "inbound-processing-saga",
    retries: 2,
    onFailure: async ({ event }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const conversationId = event.data.event.data.conversationId;
      if (conversationId) {
        await p.conversation.update({
          where: { id: conversationId },
          data: { status: "PENDENTE_HUMANO" },
        });
      }
    },
  },
  { event: "inbound/received" },
  async ({ event, step }) => {
    const { from, body, channel, customerId, conversationId, messageId, franqueadoraId } = event.data;

    // Step 1: Ensure customer and conversation exist
    const context = await step.run("ensure-context", async () => {
      let custId = customerId;
      let convId = conversationId;

      // If no customer, try to find by phone
      if (!custId) {
        const customer = await prisma.customer.findFirst({
          where: {
            OR: [
              { phone: from },
              { whatsappPhone: from },
            ],
            franqueadoraId,
          },
        });
        custId = customer?.id;
      }

      if (!custId) {
        return { skip: true, reason: "customer-not-found" };
      }

      // Find or create conversation
      if (!convId) {
        let conv = await prisma.conversation.findFirst({
          where: {
            customerId: custId,
            channel,
            status: { not: "RESOLVIDA" },
          },
        });

        if (!conv) {
          conv = await prisma.conversation.create({
            data: {
              customerId: custId,
              channel,
              status: "PENDENTE_IA",
              franqueadoraId,
            },
          });
        }

        convId = conv.id;
      }

      return { skip: false, customerId: custId, conversationId: convId };
    });

    if (context.skip) {
      return { result: "skipped", reason: context.reason };
    }

    const { customerId: custId, conversationId: convId } = context as {
      customerId: string;
      conversationId: string;
    };

    // Step 2: Build context and get AI decision
    const decision = await step.run("ai-decide-response", async () => {
      const ctx = await buildInboundContext(convId!, body);
      if (!ctx) return null;
      return decideInboundResponse(ctx);
    });

    if (!decision) {
      return { result: "ai-unavailable" };
    }

    // Step 3: Log AI decision
    await step.sendEvent("log-decision", {
      name: "ai/inbound-decided",
      data: {
        conversationId: convId!,
        customerId: custId!,
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        franqueadoraId,
      },
    });

    // Step 4: Safety checks
    const escalationCheck = await step.run("safety-check", async () => {
      const agentConfig = await prisma.agentConfig.findFirst({
        where: { franqueadoraId, enabled: true },
      });

      const forceEscalate = shouldForceEscalate(
        decision,
        body,
        {
          escalationThreshold: agentConfig?.escalationThreshold ?? 0.3,
          highValueThreshold: agentConfig?.highValueThreshold ?? 1000000,
        },
      );

      if (forceEscalate.shouldEscalate) {
        return { shouldEscalate: true, reason: forceEscalate.reason, details: forceEscalate.details };
      }

      // ⚠️ checkConsecutiveFailures queries MessageQueue, which is removed in Task 24.
      // Before Task 24, refactor this function to check Message.metadata delivery status instead.
      const consecutiveCheck = await checkConsecutiveFailures(custId!);
      if (consecutiveCheck.shouldEscalate) {
        return { shouldEscalate: true, reason: consecutiveCheck.reason };
      }

      return { shouldEscalate: false };
    });

    // Step 5: Execute action
    if (escalationCheck.shouldEscalate) {
      await step.sendEvent("escalate", {
        name: "ai/escalation-triggered",
        data: {
          conversationId: convId,
          customerId: custId!,
          reason: escalationCheck.reason || "SAFETY_NET",
          details: escalationCheck.details,
          franqueadoraId,
        },
      });
      return { result: "escalated", reason: escalationCheck.reason };
    }

    // Dispatch AI response
    if (decision.message) {
      await step.run("dispatch-response", async () => {
        const message = await prisma.message.create({
          data: {
            conversationId: convId!,
            sender: "AI",
            content: decision.message!,
            contentType: "text",
            channel,
          },
        });

        await dispatchMessage({
          channel,
          content: decision.message!,
          customerId: custId!,
          conversationId: convId!,
          messageId: message.id,
          franqueadoraId,
        });

        // Update conversation status
        await prisma.conversation.update({
          where: { id: convId! },
          data: { status: "ABERTA", lastMessageAt: new Date() },
        });
      });
    }

    return { result: "responded", action: decision.action };
  }
);
```

- [ ] **Step 2: Register in inngest/index.ts**

Add `inboundProcessing` to imports and `allFunctions`.

- [ ] **Step 3: Commit**

```bash
git add inngest/sagas/inbound-processing.ts inngest/index.ts
git commit -m "feat: add inbound-processing saga (replaces processInboundMessage)"
```

---

### Task 16: Implement omie-sync saga

**Files:**
- Create: `inngest/sagas/omie-sync.ts`
- Modify: `inngest/index.ts`

- [ ] **Step 1: Create omie-sync saga**

Create `inngest/sagas/omie-sync.ts`:

```typescript
import { inngest } from "../client";
import { processOmieWebhook } from "@/lib/integrations/omie/processWebhook";

export const omieSync = inngest.createFunction(
  {
    id: "omie-sync-saga",
    retries: 5,
  },
  { event: "integration/omie-webhook-received" },
  async ({ event, step }) => {
    const { topic, payload, franqueadoraId } = event.data;

    // Step 1: Process the webhook (reuse existing logic)
    const result = await step.run("process-webhook", async () => {
      return processOmieWebhook({ topic, ...payload });
    });

    // Step 2: Emit downstream events based on topic
    if (topic.startsWith("financas.contareceber")) {
      // The processOmieWebhook already handles charge creation/update
      // Emit event for downstream consumers (risk score, etc.)
      if (result.chargeId) {
        const eventName = result.status === "PAID" ? "charge/paid" : "charge/created";
        await step.sendEvent("emit-charge-event", {
          name: eventName as "charge/paid" | "charge/created",
          data: {
            chargeId: result.chargeId,
            customerId: result.customerId || "",
            ...(eventName === "charge/paid"
              ? { amountPaidCents: result.amountPaidCents || 0 }
              : { amountCents: result.amountCents || 0, dueDate: result.dueDate || "" }),
            franqueadoraId,
          },
        });
      }
    }

    if (topic.startsWith("geral.clientes") || topic.startsWith("clientefornecedor")) {
      if (result.customerId) {
        await step.sendEvent("emit-customer-event", {
          name: "customer/updated",
          data: {
            customerId: result.customerId,
            franqueadoraId,
          },
        });
      }
    }

    return { processed: true, topic, detail: result.detail };
  }
);
```

**⚠️ Prerequisite:** Before implementing this saga, modify `processOmieWebhook()` in `lib/integrations/omie/processWebhook.ts` to return `chargeId`, `customerId`, `status`, `amountPaidCents`, `amountCents`, and `dueDate` in its result object (currently returns only `{ processed, detail }`). Add a step in this task to make this modification before implementing the saga.

- [ ] **Step 2: Register in inngest/index.ts — final state with all functions**

Update `inngest/index.ts` to its final state with all 13 functions:

```typescript
export { inngest } from "./client";

// Reactive functions
import { updateRiskScore } from "./functions/update-risk-score";
import { logInteraction } from "./functions/log-interaction";
import { handleEscalation } from "./functions/handle-escalation";
import { handleDeliveryStatus } from "./functions/handle-delivery-status";
import { notifyPaymentReceived } from "./functions/notify-payment-received";
import { logAgentDecision } from "./functions/log-agent-decision";
import { dispatchOnSend } from "./functions/dispatch-on-send";

// Scheduled functions
import { checkPendingCharges } from "./scheduled/check-pending-charges";
import { recalculateRiskScores } from "./scheduled/recalculate-risk-scores";

// Sagas
import { chargeLifecycle } from "./sagas/charge-lifecycle";
import { dunningSaga } from "./sagas/dunning-saga";
import { inboundProcessing } from "./sagas/inbound-processing";
import { omieSync } from "./sagas/omie-sync";

export const allFunctions = [
  // Reactive
  updateRiskScore,
  logInteraction,
  handleEscalation,
  handleDeliveryStatus,
  notifyPaymentReceived,
  logAgentDecision,
  dispatchOnSend,
  // Scheduled
  checkPendingCharges,
  recalculateRiskScores,
  // Sagas
  chargeLifecycle,
  dunningSaga,
  inboundProcessing,
  omieSync,
];
```

- [ ] **Step 3: Commit**

```bash
git add inngest/sagas/omie-sync.ts inngest/index.ts
git commit -m "feat: add omie-sync saga (all 13 Inngest functions complete)"
```

---

## Chunk 5: Producers — Modify API Routes

### Task 17: Modify charge API routes to emit events

**Files:**
- Modify: `app/api/charges/route.ts:66-106`
- Modify: `app/api/charges/[id]/route.ts:23-67`

- [ ] **Step 1: Add event emission to POST /api/charges**

In `app/api/charges/route.ts`, after the `prisma.charge.create()` call, add:

```typescript
import { inngest } from "@/inngest";

// After: const charge = await prisma.charge.create({ ... })
// Add:
await inngest.send({
  name: "charge/created",
  data: {
    chargeId: charge.id,
    customerId: charge.customerId,
    amountCents: charge.amountCents,
    dueDate: charge.dueDate.toISOString(),
    franqueadoraId: tenantId!,
  },
});
```

- [ ] **Step 2: Add event emission to PATCH /api/charges/[id]**

In `app/api/charges/[id]/route.ts` PATCH handler, after the `prisma.charge.update()` call, add:

```typescript
import { inngest } from "@/inngest";

// After: const updated = await prisma.charge.update({ ... })
// Add:
if (body.status === "CANCELED") {
  await inngest.send({
    name: "charge/canceled",
    data: {
      chargeId: updated.id,
      customerId: updated.customerId,
      franqueadoraId: tenantId!,
    },
  });
} else {
  await inngest.send({
    name: "charge/updated",
    data: {
      chargeId: updated.id,
      franqueadoraId: tenantId!,
    },
  });
}
```

- [ ] **Step 3: Add event emission to DELETE /api/charges/[id]**

In DELETE handler, after the `prisma.charge.delete()` call, add:

```typescript
await inngest.send({
  name: "charge/canceled",
  data: {
    chargeId: params.id,
    customerId: charge.customerId,
    franqueadoraId: tenantId!,
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add app/api/charges/route.ts app/api/charges/\[id\]/route.ts
git commit -m "feat: emit charge events from API routes"
```

---

### Task 18: Refactor dispatch.ts to remove MessageQueue dependency

**Files:**
- Modify: `lib/agent/dispatch.ts`

The current `dispatchMessage()` takes a `MessageQueue` item. Refactor it to accept a plain object so sagas can call it without the queue table.

- [ ] **Step 1: Create new dispatch interface and refactor**

In `lib/agent/dispatch.ts`, add a new interface and refactor `dispatchMessage`:

```typescript
// Add this interface at the top of the file:
export interface DispatchRequest {
  channel: Channel;
  content: string;
  customerId: string;
  conversationId?: string;
  messageId?: string;
  franqueadoraId: string;
}

// Rename old function to dispatchQueueItem (keep for backward compat during migration)
// Add new function:
export async function dispatchMessage(request: DispatchRequest): Promise<DispatchResult> {
  const { channel, content, customerId, franqueadoraId } = request;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    let result: DispatchResult;

    switch (channel) {
      case "WHATSAPP":
        result = await sendWhatsApp(customer.whatsappPhone || customer.phone, content, franqueadoraId);
        break;
      case "SMS":
        result = await sendSms(customer.phone, content, franqueadoraId);
        break;
      case "EMAIL":
        result = await sendRawEmail(customer.email, content, franqueadoraId);
        break;
      default:
        return { success: false, error: `Unsupported channel: ${channel}` };
    }

    // Update message record if provided
    if (request.messageId && result.success && result.providerMsgId) {
      await prisma.message.update({
        where: { id: request.messageId },
        data: { externalId: result.providerMsgId },
      });
    }

    return result;
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
```

Keep the existing provider functions (`sendWhatsApp`, `sendSms`, `sendRawEmail`) unchanged. Import them as:
```typescript
import { sendWhatsApp, sendSms } from "./providers/twilio";
import { sendRawEmail } from "./providers/customerio";
```

Remove the old `dispatchMessage` that takes a `MessageQueue` item, `processPendingQueue`, and `dispatchImmediate` functions.

- [ ] **Step 2: Verify saga imports compile**

```bash
npx tsc --noEmit inngest/sagas/dunning-saga.ts
```

- [ ] **Step 3: Commit**

```bash
git add lib/agent/dispatch.ts
git commit -m "refactor: decouple dispatch.ts from MessageQueue"
```

---

### Task 19: Modify webhook routes to emit events

**Files:**
- Modify: `app/api/webhooks/twilio/route.ts`
- Modify: `app/api/webhooks/twilio/status/route.ts`
- Modify: `app/api/webhooks/customerio/route.ts`
- Modify: `app/api/integrations/omie/webhook/route.ts`

- [ ] **Step 1: Modify Twilio inbound webhook**

In `app/api/webhooks/twilio/route.ts`:

1. Add `import { inngest } from "@/inngest";` at the top
2. Keep the customer creation/lookup logic (needed for webhook response)
3. Replace the fire-and-forget `fetch()` to `/api/agent/process-inbound` (around line 206-218) with:

```typescript
await inngest.send({
  name: "inbound/received",
  data: {
    from: normalizedFrom,
    body: Body,
    channel: isWhatsApp ? "WHATSAPP" as Channel : "SMS" as Channel,
    providerMsgId: MessageSid,
    customerId: customer.id,
    conversationId: conversation.id,
    messageId: message.id,
    franqueadoraId: franqueadora.id,
  },
});
```

Remove the fire-and-forget fetch block.

- [ ] **Step 2: Modify Twilio status webhook**

In `app/api/webhooks/twilio/status/route.ts`:

1. Add `import { inngest } from "@/inngest";`
2. Replace the direct `prisma.messageQueue.updateMany()` with event emission:

```typescript
const isDelivered = ["delivered", "read"].includes(MessageStatus);
const eventName = isDelivered ? "message/delivered" : "message/failed";

await inngest.send({
  name: eventName as "message/delivered" | "message/failed",
  data: {
    providerMsgId: MessageSid,
    ...(isDelivered ? {} : { error: `Twilio status: ${MessageStatus}` }),
  },
});
```

- [ ] **Step 3: Modify Customer.io webhook**

In `app/api/webhooks/customerio/route.ts`:

1. Add `import { inngest } from "@/inngest";`
2. For `email_delivered` and `email_bounced` events, replace direct DB update with:

```typescript
if (event_type === "email_delivered") {
  await inngest.send({
    name: "message/delivered",
    data: { providerMsgId: data.message_id },
  });
} else if (event_type === "email_bounced") {
  await inngest.send({
    name: "message/failed",
    data: { providerMsgId: data.message_id, error: "Email bounced" },
  });
}
```

3. For `email_replied`, keep the customer/conversation lookup and replace fire-and-forget with:

```typescript
await inngest.send({
  name: "inbound/received",
  data: {
    from: data.from_email,
    body: data.body,
    channel: "EMAIL" as Channel,
    providerMsgId: data.message_id,
    customerId: customer.id,
    conversationId: conversation.id,
    messageId: message.id,
    franqueadoraId,
  },
});
```

- [ ] **Step 4: Modify Omie webhook**

In `app/api/integrations/omie/webhook/route.ts`:

1. Add `import { inngest } from "@/inngest";`
2. Replace `processOmieWebhook(body)` call with event emission:

```typescript
const { topic } = body;
// Determine franqueadoraId from webhook auth or body
const franqueadoraId = body.franqueadoraId || "default";

await inngest.send({
  name: "integration/omie-webhook-received",
  data: {
    topic,
    payload: body,
    franqueadoraId,
  },
});

return NextResponse.json({ ok: true });
```

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/twilio/route.ts app/api/webhooks/twilio/status/route.ts app/api/webhooks/customerio/route.ts app/api/integrations/omie/webhook/route.ts
git commit -m "feat: emit events from webhook routes (replace fire-and-forget)"
```

---

### Task 20: Modify inbox messages route

**Files:**
- Modify: `app/api/inbox/conversations/[id]/messages/route.ts:61-164`

- [ ] **Step 1: Replace MessageQueue + dispatchMessage with event emission**

In `app/api/inbox/conversations/[id]/messages/route.ts` POST handler:

1. Add `import { inngest } from "@/inngest";`
2. Remove `import { dispatchMessage } from "@/lib/agent/dispatch";` (no longer needed here)
3. Remove the `MessageQueue.create()` block and the fire-and-forget `dispatchMessage()` call
4. After creating the message, add event emission:

```typescript
// After: const newMessage = await prisma.message.create({ ... })
// Replace the MessageQueue + dispatch block with:

if (!isInternal) {
  await inngest.send({
    name: "message/sent",
    data: {
      messageId: newMessage.id,
      conversationId: conversation.id,
      chargeId: undefined,
      channel: conversation.channel,
      content: newMessage.content,
      customerId: conversation.customerId,
      franqueadoraId: tenantId!,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/inbox/conversations/\[id\]/messages/route.ts
git commit -m "feat: emit message/sent event from inbox route"
```

---

### Task 21: Modify customer API route

**Files:**
- Modify: `app/api/customers/route.ts:85-123`

- [ ] **Step 1: Add event emission to POST /api/customers**

In `app/api/customers/route.ts`, after the `prisma.customer.create()` call:

```typescript
import { inngest } from "@/inngest";

// After: const customer = await prisma.customer.create({ ... })
await inngest.send({
  name: "customer/created",
  data: {
    customerId: customer.id,
    franqueadoraId: tenantId!,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/api/customers/route.ts
git commit -m "feat: emit customer/created event from API route"
```

---

## Chunk 6: Cleanup

### Task 22: Remove cron routes and process-inbound

**Files:**
- Remove: `app/api/cron/all/route.ts`
- Remove: `app/api/cron/dunning-run/route.ts`
- Remove: `app/api/cron/message-dispatch/route.ts`
- Remove: `app/api/cron/retry-failed/route.ts`
- Remove: `app/api/agent/process-inbound/route.ts`

- [ ] **Step 1: Delete cron route files**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
rm app/api/cron/all/route.ts
rm app/api/cron/dunning-run/route.ts
rm app/api/cron/message-dispatch/route.ts
rm app/api/cron/retry-failed/route.ts
rmdir app/api/cron/all app/api/cron/dunning-run app/api/cron/message-dispatch app/api/cron/retry-failed app/api/cron 2>/dev/null || true
```

- [ ] **Step 2: Delete process-inbound route only (keep other agent routes)**

```bash
rm app/api/agent/process-inbound/route.ts
rmdir app/api/agent/process-inbound
```

**Note:** Do NOT remove `app/api/agent/` itself — it contains other routes (dashboard, decisions, escalations) that are still needed.

- [ ] **Step 3: Commit**

```bash
git add -A app/api/cron/ app/api/agent/process-inbound/
git commit -m "chore: remove cron routes and process-inbound (replaced by Inngest)"
```

---

### Task 23: Remove orchestrator.ts

**Files:**
- Remove: `lib/agent/orchestrator.ts`

- [ ] **Step 1: Delete orchestrator**

```bash
rm /Users/victorsundfeld/cobranca-facil_v2/lib/agent/orchestrator.ts
```

- [ ] **Step 2: Remove any imports of orchestrator in remaining files**

Search for imports:

```bash
grep -r "orchestrator" /Users/victorsundfeld/cobranca-facil_v2/app/ /Users/victorsundfeld/cobranca-facil_v2/lib/ --include="*.ts" -l
```

Remove or update any remaining references.

- [ ] **Step 3: Commit**

```bash
git add -A lib/agent/orchestrator.ts
git commit -m "chore: remove orchestrator.ts (logic migrated to Inngest sagas)"
```

---

### Task 24: Remove MessageQueue from Prisma schema

**Files:**
- Modify: `prisma/schema.prisma:421-428,607-633`

- [ ] **Step 1: Remove MessageQueueStatus enum**

In `prisma/schema.prisma`, remove the `MessageQueueStatus` enum (lines ~421-428):

```prisma
// DELETE THIS:
enum MessageQueueStatus {
  PENDING
  PROCESSING
  SENT
  DELIVERED
  FAILED
  DEAD_LETTER
}
```

- [ ] **Step 2: Remove MessageQueue model**

In `prisma/schema.prisma`, remove the entire `MessageQueue` model (lines ~607-633).

- [ ] **Step 3: Remove MessageQueue relations from other models**

Search for `MessageQueue` references in the schema and remove relation fields:

```bash
grep -n "MessageQueue" /Users/victorsundfeld/cobranca-facil_v2/prisma/schema.prisma
```

Remove `messageQueue MessageQueue[]` relation fields from `Charge`, `Customer`, and `Conversation` models.

- [ ] **Step 4: Remove references to MessageQueue in code**

```bash
grep -r "messageQueue\|MessageQueue\|MessageQueueStatus" /Users/victorsundfeld/cobranca-facil_v2/lib/ /Users/victorsundfeld/cobranca-facil_v2/app/ --include="*.ts" -l
```

Clean up any remaining references (the dispatch.ts refactor in Task 17 should have handled most).

- [ ] **Step 5: Generate Prisma client**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
npx prisma generate
```

- [ ] **Step 6: Create migration**

```bash
npx prisma migrate dev --name remove-message-queue
```

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "chore: remove MessageQueue model from Prisma schema"
```

---

### Task 25: Update vercel.json to remove crons

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Remove crons section from vercel.json**

Remove the `crons` array from `vercel.json`. If that's the only content, the file can be reduced to `{}` or removed entirely.

Current content has crons for `/api/cron/all` and `/api/integrations/omie/sync`. Remove only the cron entries — keep any other Vercel config (rewrites, headers, etc.) if present.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore: remove Vercel cron jobs (replaced by Inngest scheduled functions)"
```

---

### Task 26: Final verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Fix any build errors.

- [ ] **Step 3: Start dev server and verify Inngest endpoint**

```bash
npm run dev
```

1. Visit `http://localhost:3000/api/inngest` — should return introspection JSON listing all 13 functions
2. Run `npx inngest-cli@latest dev` in another terminal — should connect to your app and show all functions in the dashboard

- [ ] **Step 4: Test a simple event flow**

In Inngest dev dashboard:
1. Send a test `charge/created` event with sample data
2. Verify that `charge-lifecycle` saga starts
3. Verify that no errors appear

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete event-driven architecture migration with Inngest"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: Foundation | 1-3 | Inngest installed, client, events, serve endpoint, middleware |
| 2: Reactive Functions | 4-10 | 7 flat functions (risk, logs, escalation, delivery, payment, AI decisions, dispatch-on-send) |
| 3: Scheduled Functions | 11-12 | 2 scheduled functions (replace Vercel crons) |
| 4: Sagas | 13-16 | 4 sagas (charge lifecycle, dunning, inbound, omie sync) |
| 5: Producers | 17-21 | All API routes and webhooks emit events |
| 6: Cleanup | 22-26 | Remove crons, orchestrator, MessageQueue, verify build |
