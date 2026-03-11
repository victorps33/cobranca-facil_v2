# Scale Architecture Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 architectural issues identified in the scale diagnostic to make the Inngest event-driven system production-ready at scale.

**Architecture:** Incremental hardening — concurrency controls, idempotency guards, paginated batch processing, onFailure handlers, and missing indexes. No new abstractions; fix existing code.

**Tech Stack:** Inngest v3, Prisma (PostgreSQL), Next.js 14 App Router, TypeScript

---

## Chunk 1: Concurrency Controls + Indexes (Foundation)

### Task 1: Add concurrency keys to all 4 sagas

**Files:**
- Modify: `inngest/sagas/charge-lifecycle.ts:4-8`
- Modify: `inngest/sagas/dunning-saga.ts:7-10`
- Modify: `inngest/sagas/inbound-processing.ts:8-11`
- Modify: `inngest/sagas/omie-sync.ts:5-8`

- [ ] **Step 1: Add concurrency to charge-lifecycle**

In `inngest/sagas/charge-lifecycle.ts`, replace the config object:

```typescript
export const chargeLifecycle = inngest.createFunction(
  {
    id: "charge-lifecycle",
    retries: 3,
    concurrency: [{ key: "event.data.chargeId", limit: 1 }],
  },
```

- [ ] **Step 2: Add concurrency to dunning-saga**

In `inngest/sagas/dunning-saga.ts`, add concurrency inside the config (after `retries: 3,`, before `onFailure`):

```typescript
export const dunningSaga = inngest.createFunction(
  {
    id: "dunning-saga",
    retries: 3,
    concurrency: [{ key: "event.data.chargeId", limit: 1 }],
    onFailure: async ({ event, error }) => {
```

- [ ] **Step 3: Add concurrency to inbound-processing**

In `inngest/sagas/inbound-processing.ts`:

```typescript
export const inboundProcessing = inngest.createFunction(
  {
    id: "inbound-processing-saga",
    retries: 2,
    concurrency: [{ key: "event.data.conversationId || event.data.from", limit: 1 }],
    onFailure: async ({ event }) => {
```

- [ ] **Step 4: Add concurrency to omie-sync**

In `inngest/sagas/omie-sync.ts`:

```typescript
export const omieSync = inngest.createFunction(
  {
    id: "omie-sync-saga",
    retries: 5,
    concurrency: [{ key: "event.data.topic", limit: 3 }],
  },
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add inngest/sagas/
git commit -m "feat: add concurrency keys to all 4 sagas

Prevents duplicate customer messages and race conditions from
concurrent event processing on the same chargeId/conversationId."
```

### Task 2: Add concurrency keys to all 7 reactive functions

**Files:**
- Modify: `inngest/functions/update-risk-score.ts:5-9`
- Modify: `inngest/functions/log-interaction.ts:16-20`
- Modify: `inngest/functions/handle-escalation.ts:5-9`
- Modify: `inngest/functions/handle-delivery-status.ts:4-8`
- Modify: `inngest/functions/notify-payment-received.ts:4-8`
- Modify: `inngest/functions/log-agent-decision.ts:5-9`
- Modify: `inngest/functions/dispatch-on-send.ts:4-8`

- [ ] **Step 1: Add concurrency to all reactive functions**

For each function, add `concurrency` to the config. The key depends on the function's scope:

**update-risk-score.ts** — key by customerId (one recalc per customer at a time):
```typescript
{
  id: "update-risk-score",
  retries: 3,
  concurrency: [{ key: "event.data.customerId", limit: 1 }],
},
```

**log-interaction.ts** — key by customerId:
```typescript
{
  id: "log-interaction",
  retries: 3,
  concurrency: [{ key: "event.data.customerId", limit: 1 }],
},
```

**handle-escalation.ts** — key by conversationId (one escalation per conversation):
```typescript
{
  id: "handle-escalation",
  retries: 5,
  concurrency: [{ key: "event.data.conversationId || event.data.customerId", limit: 1 }],
},
```

**handle-delivery-status.ts** — key by providerMsgId:
```typescript
{
  id: "handle-delivery-status",
  retries: 3,
  concurrency: [{ key: "event.data.providerMsgId", limit: 1 }],
},
```

**notify-payment-received.ts** — key by chargeId:
```typescript
{
  id: "notify-payment-received",
  retries: 3,
  concurrency: [{ key: "event.data.chargeId", limit: 1 }],
},
```

**log-agent-decision.ts** — key by customerId:
```typescript
{
  id: "log-agent-decision",
  retries: 3,
  concurrency: [{ key: "event.data.customerId", limit: 1 }],
},
```

**dispatch-on-send.ts** — key by messageId (one dispatch per message):
```typescript
{
  id: "dispatch-on-send",
  retries: 3,
  concurrency: [{ key: "event.data.messageId", limit: 1 }],
},
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add inngest/functions/
git commit -m "feat: add concurrency keys to all 7 reactive functions

Prevents duplicate dispatches, duplicate escalations, and
race conditions from concurrent event processing."
```

### Task 3: Add missing database indexes to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Customer phone indexes**

After `@@index([franqueadoraId])` on Customer model (line 114), add:

```prisma
  @@index([phone])
  @@index([whatsappPhone])
```

- [ ] **Step 2: Add composite index on Charge (status, dueDate)**

After `@@index([dueDate])` on Charge model (line 158), add:

```prisma
  @@index([status, dueDate])
```

- [ ] **Step 3: Add composite index on DunningRule**

After `@@index([franqueadoraId])` on DunningRule model (line 203), add:

```prisma
  @@index([franqueadoraId, riskProfile, active])
```

- [ ] **Step 4: Add indexes on EscalationTask**

After `createdAt` on EscalationTask model (line 170), add:

```prisma
  @@index([chargeId])
  @@index([status])
```

- [ ] **Step 5: Add unique constraint on NotificationLog (chargeId, stepId)**

After `@@index([scheduledFor])` on NotificationLog model (line 305), add:

```prisma
  @@unique([chargeId, stepId])
```

- [ ] **Step 6: Generate Prisma migration**

Run: `npx prisma migrate dev --name add-scale-indexes --create-only`
Verify the SQL migration file looks correct.

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat: add missing indexes for scale

- Customer.phone and whatsappPhone for inbound lookup
- Charge(status, dueDate) composite for daily cron
- DunningRule(franqueadoraId, riskProfile, active) composite
- EscalationTask indexes on chargeId and status
- NotificationLog @@unique([chargeId, stepId]) for idempotency"
```

---

## Chunk 2: onFailure Handlers + Idempotency Guards

### Task 4: Add onFailure handlers to all reactive functions that lack them

**Files:**
- Modify: `inngest/functions/dispatch-on-send.ts`
- Modify: `inngest/functions/handle-delivery-status.ts`
- Modify: `inngest/functions/notify-payment-received.ts`
- Modify: `inngest/functions/log-interaction.ts`
- Modify: `inngest/functions/log-agent-decision.ts`
- Modify: `inngest/functions/handle-escalation.ts`
- Modify: `inngest/sagas/charge-lifecycle.ts`
- Modify: `inngest/sagas/omie-sync.ts`

- [ ] **Step 1: Add onFailure to dispatch-on-send**

This is the most critical — a failed dispatch means the customer never receives the message:

```typescript
export const dispatchOnSend = inngest.createFunction(
  {
    id: "dispatch-on-send",
    retries: 3,
    concurrency: [{ key: "event.data.messageId", limit: 1 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      // Update message metadata to reflect failure
      if (data.messageId) {
        await p.message.update({
          where: { id: data.messageId },
          data: {
            metadata: JSON.stringify({
              deliveryStatus: "FAILED",
              error: error.message,
              failedAt: new Date().toISOString(),
            }),
          },
        });
      }
      // Create collection task for human review
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (systemUser && data.customerId) {
        await p.collectionTask.create({
          data: {
            title: `[FALHA ENVIO] Mensagem não entregue após retries`,
            description: `Canal: ${data.channel}\nErro: ${error.message}\nConteúdo: ${data.content?.slice(0, 500)}`,
            priority: "ALTA",
            status: "PENDENTE",
            customerId: data.customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
```

- [ ] **Step 2: Add onFailure to handle-escalation**

```typescript
export const handleEscalation = inngest.createFunction(
  {
    id: "handle-escalation",
    retries: 5,
    concurrency: [{ key: "event.data.conversationId || event.data.customerId", limit: 1 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      // Critical: if escalation itself fails, create a task
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (systemUser && data.customerId) {
        await p.collectionTask.create({
          data: {
            title: `[FALHA ESCALAÇÃO] Escalação falhou após 5 retries`,
            description: `Razão original: ${data.reason}\nDetalhes: ${data.details}\nErro: ${error.message}`,
            priority: "CRITICA",
            status: "PENDENTE",
            customerId: data.customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
```

- [ ] **Step 3: Add onFailure to notify-payment-received**

```typescript
export const notifyPaymentReceived = inngest.createFunction(
  {
    id: "notify-payment-received",
    retries: 3,
    concurrency: [{ key: "event.data.chargeId", limit: 1 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (systemUser && data.customerId) {
        await p.collectionTask.create({
          data: {
            title: `[FALHA PAGAMENTO] Status não atualizado para cobrança ${data.chargeId}`,
            description: `Erro: ${error.message}`,
            priority: "ALTA",
            status: "PENDENTE",
            customerId: data.customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
```

- [ ] **Step 4: Add onFailure to charge-lifecycle and omie-sync**

**charge-lifecycle.ts:**
```typescript
export const chargeLifecycle = inngest.createFunction(
  {
    id: "charge-lifecycle",
    retries: 3,
    concurrency: [{ key: "event.data.chargeId", limit: 1 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (systemUser && data.customerId) {
        await p.collectionTask.create({
          data: {
            title: `[FALHA LIFECYCLE] Ciclo da cobrança ${data.chargeId} falhou`,
            description: `Erro: ${error.message}`,
            priority: "ALTA",
            status: "PENDENTE",
            customerId: data.customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
```

**omie-sync.ts:**
```typescript
export const omieSync = inngest.createFunction(
  {
    id: "omie-sync-saga",
    retries: 5,
    concurrency: [{ key: "event.data.topic", limit: 3 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      // Find any admin user to create the task
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      // Find any customer from this franqueadora to attach the task
      if (systemUser) {
        const customer = await p.customer.findFirst({
          where: { franqueadoraId: data.franqueadoraId },
          select: { id: true },
        });
        if (customer) {
          await p.collectionTask.create({
            data: {
              title: `[FALHA OMIE] Sync falhou: ${data.topic}`,
              description: `Erro: ${error.message}\nPayload: ${JSON.stringify(data.payload).slice(0, 500)}`,
              priority: "ALTA",
              status: "PENDENTE",
              customerId: customer.id,
              createdById: systemUser.id,
            },
          });
        }
      }
    },
  },
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add inngest/
git commit -m "feat: add onFailure handlers to all functions and sagas

Creates CollectionTask records on exhausted retries so failures
are never silently dropped. Critical for operational visibility."
```

### Task 5: Add idempotency guards to reactive functions

**Files:**
- Modify: `inngest/functions/log-interaction.ts`
- Modify: `inngest/functions/log-agent-decision.ts`
- Modify: `inngest/functions/handle-delivery-status.ts`
- Modify: `inngest/functions/handle-escalation.ts`
- Modify: `inngest/sagas/dunning-saga.ts:158-211`

- [ ] **Step 1: Add idempotency key to log-interaction**

Use `event.id` (Inngest event ID) as an idempotency key. In `log-interaction.ts`, replace the `create` call:

```typescript
  async ({ event }) => {
    const isInbound = event.name === "inbound/received";
    const customerId = event.data.customerId;

    if (!customerId) {
      return { logged: false, reason: "no customerId" };
    }

    // Idempotency: check if this event was already processed
    const existing = await prisma.interactionLog.findFirst({
      where: {
        customerId,
        content: isInbound
          ? (event.data as { body: string }).body
          : (event.data as { content: string }).content,
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });

    if (existing) {
      return { logged: false, reason: "duplicate" };
    }

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
```

- [ ] **Step 2: Add idempotency key to log-agent-decision**

In `log-agent-decision.ts`, add dedup check before create:

```typescript
  async ({ event }) => {
    const { action, confidence, reasoning, franqueadoraId } = event.data;

    // Idempotency: check for recent duplicate decision log
    const existing = await prisma.agentDecisionLog.findFirst({
      where: {
        customerId: event.data.customerId,
        action: action as AgentAction,
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });

    if (existing) {
      return { logged: false, reason: "duplicate" };
    }

    await prisma.agentDecisionLog.create({
      data: {
        chargeId: "chargeId" in event.data ? event.data.chargeId : undefined,
        conversationId: "conversationId" in event.data ? event.data.conversationId : undefined,
        customerId: event.data.customerId,
        action: action as AgentAction,
        confidence,
        reasoning,
        inputContext: JSON.stringify(event.data),
        franqueadoraId,
        executedAt: new Date(),
      },
    });

    return { logged: true, action };
  }
```

- [ ] **Step 3: Use upsert in dunning-saga NotificationLog**

In `dunning-saga.ts`, replace the `findFirst` + `create` pattern (lines 158-211) with `upsert` using the new `@@unique([chargeId, stepId])` constraint:

Replace the `check-dup` step and `dispatch` step. Remove lines 157-164 (the `check-dup` step) entirely and change the `dispatch` step to use `upsert`:

In the dispatch step (line 196-211), change the NotificationLog `create` to `upsert`:

```typescript
          // Upsert NotificationLog — idempotent via @@unique([chargeId, stepId])
          await prisma.notificationLog.upsert({
            where: {
              chargeId_stepId: { chargeId, stepId: dunningStep.id },
            },
            create: {
              chargeId,
              stepId: dunningStep.id,
              channel: dunningStep.channel,
              status: "SENT",
              scheduledFor: new Date(),
              renderedMessage: decision.message!,
              metaJson: JSON.stringify({
                trigger: dunningStep.trigger,
                offsetDays: dunningStep.offsetDays,
                aiConfidence: decision.confidence,
                aiAction: decision.action,
              }),
            },
            update: {},
          });
```

- [ ] **Step 4: Merge metadata in handle-delivery-status**

In `handle-delivery-status.ts`, merge metadata instead of replacing:

```typescript
    // Merge with existing metadata instead of replacing
    const existingMeta = message.metadata ? JSON.parse(message.metadata) : {};

    if (isDelivered) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          metadata: JSON.stringify({
            ...existingMeta,
            deliveryStatus: "DELIVERED",
            deliveredAt: new Date().toISOString(),
          }),
        },
      });
    } else {
      const error = (event.data as { error: string }).error;
      await prisma.message.update({
        where: { id: message.id },
        data: {
          metadata: JSON.stringify({
            ...existingMeta,
            deliveryStatus: "FAILED",
            error,
            failedAt: new Date().toISOString(),
          }),
        },
      });
```

- [ ] **Step 5: Fix handle-escalation return when no conversationId**

In `handle-escalation.ts`, fix the misleading return:

```typescript
    if (!conversationId) {
      return { escalated: false, reason: "no-conversation-id" };
    }
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add inngest/
git commit -m "feat: add idempotency guards to reactive functions

- Dedup checks in log-interaction and log-agent-decision
- Upsert in dunning-saga NotificationLog (uses @@unique constraint)
- Merge metadata in handle-delivery-status (no overwrite)
- Fix handle-escalation misleading return"
```

---

## Chunk 3: Batch Processing Fixes

### Task 6: Paginate check-pending-charges with cursor-based batching

**Files:**
- Modify: `inngest/scheduled/check-pending-charges.ts`

- [ ] **Step 1: Rewrite with paginated batching**

Replace the entire function body to process charges in batches of 500:

```typescript
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 500;

export const checkPendingCharges = inngest.createFunction(
  {
    id: "check-pending-charges",
    retries: 3,
    onFailure: async ({ error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      const customer = await p.customer.findFirst({ select: { id: true } });
      if (systemUser && customer) {
        await p.collectionTask.create({
          data: {
            title: "[FALHA CRON] check-pending-charges falhou",
            description: `Erro: ${error.message}`,
            priority: "CRITICA",
            status: "PENDENTE",
            customerId: customer.id,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  { cron: "0 8 * * *" },
  async ({ step }) => {
    let totalProcessed = 0;
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const batchResult = await step.run(`find-overdue-batch-${totalProcessed}`, async () => {
        const now = new Date();
        const charges = await prisma.charge.findMany({
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
          orderBy: { id: "asc" },
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });

        return {
          charges,
          lastId: charges.length > 0 ? charges[charges.length - 1].id : undefined,
          count: charges.length,
        };
      });

      if (batchResult.count === 0) {
        hasMore = false;
        break;
      }

      cursor = batchResult.lastId;
      hasMore = batchResult.count === BATCH_SIZE;

      // Mark batch as OVERDUE
      await step.run(`mark-overdue-${totalProcessed}`, async () => {
        await prisma.charge.updateMany({
          where: {
            id: { in: batchResult.charges.map((c) => c.id) },
            status: "PENDING",
          },
          data: { status: "OVERDUE" },
        });
      });

      // Emit events for this batch
      const validCharges = batchResult.charges.filter((c) => c.customer.franqueadoraId != null);
      if (validCharges.length > 0) {
        await step.sendEvent(
          `emit-overdue-${totalProcessed}`,
          validCharges.map((charge) => ({
            name: "charge/overdue" as const,
            data: {
              chargeId: charge.id,
              customerId: charge.customerId,
              daysPastDue: Math.floor(
                (Date.now() - new Date(charge.dueDate).getTime()) / (1000 * 60 * 60 * 24)
              ),
              franqueadoraId: charge.customer.franqueadoraId!,
            },
          }))
        );
      }

      totalProcessed += batchResult.count;
    }

    return { processed: totalProcessed };
  }
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add inngest/scheduled/check-pending-charges.ts
git commit -m "feat: paginate check-pending-charges with cursor-based batching

Processes charges in batches of 500 with cursor pagination.
Prevents memory issues and Inngest step size limits at scale.
Includes onFailure handler for operational visibility."
```

### Task 7: Fan-out recalculate-risk-scores with per-batch steps

**Files:**
- Modify: `inngest/scheduled/recalculate-risk-scores.ts`

- [ ] **Step 1: Rewrite with batched step.run calls**

Replace the entire function to process customers in batches:

```typescript
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { calculateRiskForCustomer } from "@/lib/risk-score";

const BATCH_SIZE = 100;

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

    let totalRecalculated = 0;

    for (const franqueadora of franqueadoras) {
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const batchResult = await step.run(
          `recalc-${franqueadora.id}-${totalRecalculated}`,
          async () => {
            const customers = await prisma.customer.findMany({
              where: { franqueadoraId: franqueadora.id },
              select: { id: true },
              orderBy: { id: "asc" },
              take: BATCH_SIZE,
              ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            });

            let processed = 0;
            for (const customer of customers) {
              const result = await calculateRiskForCustomer(customer.id);
              await prisma.franchiseeRiskScore.upsert({
                where: { customerId: customer.id },
                create: {
                  customerId: customer.id,
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
                  calculatedAt: new Date(),
                },
              });
              processed++;
            }

            return {
              lastId: customers.length > 0 ? customers[customers.length - 1].id : undefined,
              count: customers.length,
              processed,
            };
          }
        );

        cursor = batchResult.lastId;
        hasMore = batchResult.count === BATCH_SIZE;
        totalRecalculated += batchResult.processed;
      }
    }

    return { recalculated: totalRecalculated };
  }
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add inngest/scheduled/recalculate-risk-scores.ts
git commit -m "feat: batch recalculate-risk-scores with per-batch steps

Processes customers in batches of 100 with cursor pagination.
Each batch is a separate Inngest step, so retries resume from
the last successful batch instead of restarting from scratch."
```

---

## Chunk 4: Webhook Idempotency

### Task 8: Add webhook idempotency guards and make externalId unique

**Files:**
- Modify: `app/api/webhooks/twilio/route.ts`
- Modify: `app/api/webhooks/twilio/status/route.ts`
- Modify: `app/api/webhooks/customerio/route.ts`

- [ ] **Step 1: Add externalId dedup to Twilio inbound webhook**

In `app/api/webhooks/twilio/route.ts`, before creating the message, add an idempotency check using `MessageSid`:

Find the message creation section and add a check before it. The message is created with `externalId: MessageSid`. Add before the message creation:

```typescript
      // Idempotency: check if this MessageSid was already processed
      const existingMsg = await prisma.message.findFirst({
        where: { externalId: MessageSid },
      });

      if (existingMsg) {
        return NextResponse.json({ status: "duplicate", messageId: existingMsg.id });
      }
```

- [ ] **Step 2: Add dedup to Twilio status webhook**

In `app/api/webhooks/twilio/status/route.ts`, add check for already-processed status. This is simpler — the status webhook is idempotent by nature (emitting the same event is safe since the handler merges metadata). No change needed here since the function already has concurrency controls.

- [ ] **Step 3: Add dedup to Customer.io webhook**

In `app/api/webhooks/customerio/route.ts`, before creating the inbound message, add idempotency check using `delivery_id`:

```typescript
      // Idempotency: check if this delivery was already processed
      const existingMsg = await prisma.message.findFirst({
        where: { externalId: delivery_id },
      });

      if (existingMsg) {
        return NextResponse.json({ status: "duplicate" });
      }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/
git commit -m "feat: add webhook idempotency guards

Check externalId (MessageSid/delivery_id) before creating messages
to prevent duplicate processing from webhook retransmissions."
```

---

## Chunk 5: Step Granularity + Transaction Safety

### Task 9: Split dispatch steps in dunning-saga (separate DB writes from external calls)

**Files:**
- Modify: `inngest/sagas/dunning-saga.ts:167-222`

- [ ] **Step 1: Split the dispatch step into DB writes + external dispatch**

In `dunning-saga.ts`, replace the combined `dispatch-${dunningStep.id}` step (lines 167-222) with two separate steps:

First step — DB writes (conversation, message, notification log):
```typescript
        // Step A: Prepare dispatch (DB writes only)
        const prepared = await step.run(`prepare-dispatch-${dunningStep.id}`, async () => {
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

          // Upsert NotificationLog — idempotent via @@unique([chargeId, stepId])
          await prisma.notificationLog.upsert({
            where: {
              chargeId_stepId: { chargeId, stepId: dunningStep.id },
            },
            create: {
              chargeId,
              stepId: dunningStep.id,
              channel: dunningStep.channel,
              status: "SENT",
              scheduledFor: new Date(),
              renderedMessage: decision.message!,
              metaJson: JSON.stringify({
                trigger: dunningStep.trigger,
                offsetDays: dunningStep.offsetDays,
                aiConfidence: decision.confidence,
                aiAction: decision.action,
              }),
            },
            update: {},
          });

          return {
            conversationId: conversation.id,
            messageId: message.id,
          };
        });

        // Step B: External dispatch (provider call only)
        const dispatchResult = await step.run(`dispatch-${dunningStep.id}`, async () => {
          return dispatchMessage({
            channel: dunningStep.channel,
            content: decision.message!,
            customerId,
            conversationId: prepared.conversationId,
            messageId: prepared.messageId,
            franqueadoraId,
          });
        });
```

- [ ] **Step 2: Split dispatch-response in inbound-processing**

In `inbound-processing.ts`, replace the `dispatch-response` step (lines 157-182) with two steps:

```typescript
    if (decision.message) {
      // Step A: Create message record
      const messageRecord = await step.run("create-response-message", async () => {
        return prisma.message.create({
          data: {
            conversationId: convId!,
            sender: "AI",
            content: decision.message!,
            contentType: "text",
            channel,
          },
        });
      });

      // Step B: External dispatch
      await step.run("dispatch-response", async () => {
        await dispatchMessage({
          channel,
          content: decision.message!,
          customerId: custId!,
          conversationId: convId!,
          messageId: messageRecord.id,
          franqueadoraId,
        });

        // Update conversation status
        await prisma.conversation.update({
          where: { id: convId! },
          data: { status: "ABERTA", lastMessageAt: new Date() },
        });
      });
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add inngest/sagas/dunning-saga.ts inngest/sagas/inbound-processing.ts
git commit -m "feat: split dispatch steps into DB writes + external calls

Separates message creation from external provider dispatch so that
retries after external call success don't re-create DB records or
re-send messages to customers."
```

### Task 10: Wrap executeEscalation in a transaction

**Files:**
- Modify: `lib/agent/escalation.ts:132-199`

- [ ] **Step 1: Wrap the 4 writes in a $transaction**

Replace `executeEscalation` function body:

```typescript
export async function executeEscalation(
  conversationId: string,
  customerId: string,
  reason: EscalationReason,
  details: string,
  franqueadoraId: string
): Promise<void> {
  // Fetch conversation channel and system user before transaction
  const [conversation, systemUser] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { channel: true },
    }),
    prisma.user.findFirst({
      where: { franqueadoraId, role: "ADMINISTRADOR" },
      select: { id: true },
    }),
  ]);

  if (!conversation) return;

  await prisma.$transaction(async (tx) => {
    // 1. Update conversation status
    await tx.conversation.update({
      where: { id: conversationId },
      data: { status: "PENDENTE_HUMANO" },
    });

    // 2. Create critical task
    if (systemUser) {
      await tx.collectionTask.create({
        data: {
          customerId,
          title: `[ESCALAÇÃO] ${reason}: ${details.slice(0, 100)}`,
          description: `Escalação automática da IA.\n\nMotivo: ${reason}\nDetalhes: ${details}\n\nConversation ID: ${conversationId}`,
          status: "PENDENTE",
          priority: "CRITICA",
          createdById: systemUser.id,
        },
      });
    }

    // 3. Create internal note message
    await tx.message.create({
      data: {
        conversationId,
        sender: "SYSTEM",
        content: `⚠️ Escalação automática: ${reason}\n${details}`,
        contentType: "text",
        channel: conversation.channel,
        isInternal: true,
      },
    });

    // 4. Send holding message to customer
    await tx.message.create({
      data: {
        conversationId,
        sender: "AI",
        content:
          "Obrigada pelo contato. Vou transferir você para um especialista da nossa equipe que poderá ajudá-lo(a) melhor. Em breve alguém entrará em contato.",
        contentType: "text",
        channel: conversation.channel,
        isInternal: false,
      },
    });
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/agent/escalation.ts
git commit -m "feat: wrap executeEscalation in $transaction

All 4 writes (conversation update, task, internal note, holding message)
are now atomic. Also eliminates redundant conversation re-query."
```

---

## Chunk 6: API Route Safety

### Task 11: Add try/catch around inngest.send() in critical producers

**Files:**
- Modify: `app/api/charges/route.ts`
- Modify: `app/api/charges/[id]/route.ts`
- Modify: `app/api/webhooks/twilio/route.ts`

- [ ] **Step 1: Wrap inngest.send() calls in try/catch with logging**

In each API route that calls `inngest.send()`, wrap the call in a try/catch that logs the error but does not fail the request (fire-and-forget with logging):

Example pattern for all routes:

```typescript
try {
  await inngest.send({ name: "charge/created", data: { ... } });
} catch (inngestErr) {
  console.error("[inngest] Failed to emit charge/created:", inngestErr);
}
```

Apply this pattern to:
- `app/api/charges/route.ts` — the `inngest.send("charge/created")` call
- `app/api/charges/[id]/route.ts` — the `inngest.send("charge/canceled")`, `inngest.send("charge/updated")` calls
- `app/api/webhooks/twilio/route.ts` — the `inngest.send("inbound/received")` call

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/api/
git commit -m "feat: wrap inngest.send() in try/catch in API routes

Prevents event emission failures from breaking the API response.
Logs the error for monitoring. A full outbox pattern can be added
later for guaranteed delivery."
```

### Task 12: Final verification

- [ ] **Step 1: Run TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Verify all files are committed**

Run: `git status`
Expected: Clean working directory

- [ ] **Step 3: Review the full diff**

Run: `git log --oneline feature/scale-architecture-fixes ^main`
Expected: All commits from the implementation
