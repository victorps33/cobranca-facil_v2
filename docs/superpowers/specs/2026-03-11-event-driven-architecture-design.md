# Event-Driven Architecture — Cobrança Fácil

**Date:** 2026-03-11
**Status:** Approved
**Stack:** Inngest + Next.js 14 (App Router)

## Summary

Migrate Cobrança Fácil from a cron-driven, direct-call architecture to an event-driven architecture using Inngest as the event bus. The migration is a full rewrite (big bang) with the goals of: real-time processing (replacing 12h cron polling), decoupling between modules, and scalability.

## Current Architecture

- **Pattern:** CRUD API + cron polling + PostgreSQL-backed message queue
- **Triggers:** Vercel cron jobs (`/api/cron/all` every 12h, `/api/cron/dunning-run`, `/api/cron/message-dispatch`, `/api/cron/retry-failed`)
- **Queue:** `MessageQueue` table in PostgreSQL (PENDING → PROCESSING → SENT → DELIVERED → FAILED → DEAD_LETTER)
- **Webhooks:** Twilio (SMS/WhatsApp), Customer.io (Email), Omie ERP — process synchronously or fire-and-forget
- **Side effects:** Inline in API routes (coupled)

## Target Architecture

### 4-Layer Event-Driven System

1. **Producers** — API routes, webhooks, and Inngest scheduled functions emit events via `inngest.send()`
2. **Event Bus** — Inngest Cloud routes events to all subscribers with retry, replay, and observability
3. **Consumers** — divided into **Sagas** (multi-step workflows) and **Reactors** (simple side effects)
4. **Infrastructure** — PostgreSQL (Supabase), Twilio, Customer.io, Claude AI (Anthropic)

### Approach: Events + Sagas

- Domain events for inter-module communication (pub/sub, fan-out)
- Complex workflows (dunning, inbound AI) use Inngest step functions as sagas
- Simple side effects (risk score, logs, CRM) are flat reactive functions

## Domain Events (51 total)

### Charges (7)
| Event | Origin | Side Effects |
|-------|--------|--------------|
| `charge/created` | POST /api/charges, CSV upload, Omie webhook | Create charge PENDING, generate boleto, schedule dunning |
| `charge/paid` | Omie webhook, manual update | Status → PAID, recalculate risk score, update metrics |
| `charge/overdue` | charge-lifecycle saga, check-pending-charges scheduled | Status → OVERDUE, trigger dunning saga |
| `charge/partially-paid` | Omie webhook (partial amount) | Status → PARTIAL, update amountPaidCents, recalculate risk |
| `charge/canceled` | DELETE/PATCH /api/charges/[id] | Exclude from dunning, recalculate risk score |
| `charge/updated` | PATCH /api/charges/[id] | Update description, category, payment method |
| `charge/boleto-generated` | POST /api/charges/[id]/generate-boleto | Create boleto with linha digitável and public URL |

### Customers (5)
| Event | Origin |
|-------|--------|
| `customer/created` | POST /api/customers, inbound webhook (unknown phone) |
| `customer/updated` | PATCH /api/customers/[id], Omie sync |
| `customer/deleted` | DELETE /api/customers/[id] |
| `customer/omie-linked` | Omie webhook or manual sync |
| `customer/whatsapp-updated` | Twilio webhook (new number detected) |

### Messages & Dunning (9)
| Event | Origin |
|-------|--------|
| `dunning/step-triggered` | dunning-saga step execution |
| `message/enqueued` | Saga dispatch step |
| `message/dispatched` | Dispatch function |
| `message/delivered` | Twilio/CustomerIO webhook |
| `message/failed` | Twilio/CustomerIO webhook |
| `message/sent` | Inbox (human) or AI orchestrator |
| `inbound/received` | Twilio webhook (SMS/WhatsApp), CustomerIO webhook (email) |
| `inbound/email-replied` | CustomerIO webhook |
| `dunning/run-started` | check-pending-charges scheduled function |

### AI Decisions (3)
| Event | Origin |
|-------|--------|
| `ai/collection-decided` | decideCollectionAction in dunning-saga |
| `ai/inbound-decided` | decideInboundResponse in inbound-processing saga |
| `ai/escalation-triggered` | Safety net checks, AI confidence too low, explicit request |

### Negotiation (4)
| Event | Origin |
|-------|--------|
| `negotiation/offered` | AI action = NEGOTIATE |
| `negotiation/promise-made` | AI action = MARK_PROMISE |
| `negotiation/callback-scheduled` | AI action = SCHEDULE_CALLBACK |
| `negotiation/campaign-activated` | Admin activates campaign |

### CRM & Tasks (6)
| Event | Origin |
|-------|--------|
| `task/created` | Manual or auto (escalations, failures, promises) |
| `task/assigned` | PATCH /api/crm/tasks/[id] |
| `task/completed` | PATCH status = CONCLUIDA |
| `conversation/status-changed` | PATCH or AI state transition |
| `conversation/assigned` | PATCH assignedToId |
| `interaction/logged` | POST /api/crm/interactions or auto |

### Risk Score (2)
| Event | Origin |
|-------|--------|
| `risk/score-calculated` | Reactive (charge/paid, charge/overdue) or scheduled |
| `risk/profile-changed` | Side effect of score calculation |

### External Integrations — Omie (3)
| Event | Origin |
|-------|--------|
| `integration/omie-webhook-received` | Omie ERP webhook |
| `integration/omie-customer-synced` | omie-sync saga |
| `integration/omie-charge-synced` | omie-sync saga |

### Config & System (4)
| Event | Origin |
|-------|--------|
| `config/dunning-rule-configured` | POST /api/dunning-rules |
| `config/dunning-step-configured` | POST/PATCH dunning step |
| `config/agent-updated` | Admin panel |
| `system/onboarding-completed` | POST /api/onboarding/complete |

### Imports (2)
| Event | Origin |
|-------|--------|
| `charge/import-started` | POST /api/charges/upload |
| `charge/import-confirmed` | POST /api/charges/upload/confirm |

## Sagas (4)

### 1. charge-lifecycle
- **Trigger:** `charge/created`
- **Steps:** generate boleto → `step.sleepUntil(dueDate)` → check payment status → emit `charge/overdue` if unpaid

### 2. dunning-saga (most complex)
- **Trigger:** `charge/overdue`
- **Steps:** For each dunning step in the rule:
  1. `step.sleep(offsetDays)` — wait for the step's delay
  2. `step.run("check-payment")` — verify if paid while waiting → early return if PAID
  3. `step.run("ai-decide")` — AI decides action (SEND, SKIP, ESCALATE, NEGOTIATE)
  4. `step.run("dispatch")` — send message via Twilio/CustomerIO
  5. `step.waitForEvent("message/delivered", { timeout: "24h" })` — wait for delivery confirmation
  6. If ESCALATE: `step.sendEvent("ai/escalation-triggered")` → end saga

### 3. inbound-processing
- **Trigger:** `inbound/received`
- **Steps:** ensure customer & conversation → AI decides response → safety checks → dispatch response or escalate

### 4. omie-sync
- **Trigger:** `integration/omie-webhook-received`
- **Steps:** sync customer or charge based on topic → emit downstream events (`charge/paid`, `customer/updated`)

## Reactive Functions (6)

| Function | Triggers | Action |
|----------|----------|--------|
| `update-risk-score` | charge/paid, charge/overdue, charge/partially-paid | Recalculate defaultRate, avgDaysLate, totalOutstanding |
| `log-interaction` | message/sent, message/delivered, inbound/received | Create InteractionLog for CRM history |
| `handle-escalation` | ai/escalation-triggered | Conversation → PENDENTE_HUMANO, create CRITICA task, send holding message |
| `handle-delivery-status` | message/delivered, message/failed | Update message status; create task on DEAD_LETTER |
| `notify-payment-received` | charge/paid | Update dashboard metrics |
| `log-agent-decision` | ai/collection-decided, ai/inbound-decided | Persist AgentDecisionLog with reasoning |

## Scheduled Functions (2)

| Function | Schedule | Action |
|----------|----------|--------|
| `check-pending-charges` | `0 8 * * *` (daily 8am) | Find PENDING charges past due date → emit `charge/overdue` for each |
| `recalculate-risk-scores` | `0 2 * * 1` (weekly Mon 2am) | Batch recalculate all risk scores for global consistency |

## File Structure

```
inngest/
  client.ts              ← Inngest client instance (type-safe with Events)
  events.ts              ← Type definitions for all 51 events
  index.ts               ← Re-exports client + all functions
  sagas/
    charge-lifecycle.ts
    dunning-saga.ts
    inbound-processing.ts
    omie-sync.ts
  functions/
    update-risk-score.ts
    log-interaction.ts
    handle-escalation.ts
    handle-delivery-status.ts
    notify-payment-received.ts
    log-agent-decision.ts
  scheduled/
    check-pending-charges.ts
    recalculate-risk-scores.ts

app/api/inngest/route.ts  ← serve() endpoint for Inngest
```

## Changes to Existing Code

### API Routes (modified)
Routes become thin: create DB record + `inngest.send()`. Remove inline side effects.

Example — POST /api/charges:
```typescript
// Before: create charge + generate boleto + schedule dunning + create log (coupled)
// After:
const charge = await prisma.charge.create({ data: { ... } })
await inngest.send({ name: "charge/created", data: { chargeId: charge.id, ... } })
return NextResponse.json(charge)
```

### Webhook Routes (modified)
Convert from synchronous processing / fire-and-forget to event emission:
- `webhooks/twilio/route.ts` → `inngest.send("inbound/received")`
- `webhooks/twilio/status/route.ts` → `inngest.send("message/delivered" | "message/failed")`
- `webhooks/customerio/route.ts` → `inngest.send("message/delivered" | "inbound/email-replied")`
- `integrations/omie/webhook/route.ts` → `inngest.send("integration/omie-webhook-received")`

### Files Removed
- `app/api/cron/all/route.ts`
- `app/api/cron/dunning-run/route.ts`
- `app/api/cron/message-dispatch/route.ts`
- `app/api/cron/retry-failed/route.ts`
- `app/api/agent/process-inbound/route.ts`
- `lib/agent/orchestrator.ts` (logic migrates to sagas)
- `vercel.json` crons section

### Prisma Schema Changes
- **Remove:** `MessageQueue` model, `MessageQueueStatus` enum
- **Evaluate removal:** `NotificationLog` (AgentDecisionLog + Inngest dashboard may replace it)

### Files Kept (lib/)
Business logic in `lib/` is reused by Inngest functions:
- `lib/agent/ai.ts` — `decideCollectionAction()`, `decideInboundResponse()`
- `lib/agent/dispatch.ts` — `dispatchMessage()` (without queue logic)
- `lib/agent/context-builder.ts` — `buildCollectionContext()`
- `lib/agent/escalation.ts` — escalation logic
- `lib/charges/`, `lib/customers/`, `lib/dunning/`, `lib/risk-scores/`, `lib/integrations/omie/`

## Error Handling

### Retry Policy
| Function | Retries | Backoff | onFailure |
|----------|---------|---------|-----------|
| dunning-saga | 3 | exponential | Create CRITICA CollectionTask |
| inbound-processing | 2 | exponential | Escalate to human (PENDENTE_HUMANO) |
| omie-sync | 5 | exponential | Error log + admin alert |
| charge-lifecycle | 3 | exponential | Error log (non-critical) |
| update-risk-score | 3 | linear | None (weekly recalc corrects) |
| handle-escalation | 5 | exponential | Critical log (must not fail silently) |
| log-interaction | 3 | linear | None (best-effort logging) |

### Idempotency
- **Sagas:** Inngest checkpoints each step — completed steps don't re-execute on retry
- **DB writes:** Use `upsert` with unique constraints
- **Dispatch:** Check `providerMsgId` before resending
- **Risk score:** Deterministic calculation — re-execution is safe

## Observability

- **Inngest Dashboard:** Timeline, step durations, payloads, errors, replay
- **Internal logs (kept):** AgentDecisionLog, InteractionLog, CollectionTask
- **Alerts:** onFailure handlers → CollectionTask, Inngest webhook alerts

## Testing

- **Unit tests:** Business logic in `lib/` tested in isolation (no Inngest dependency)
- **Integration tests:** `npx inngest-cli dev` for local dev server + dashboard
- **Production debugging:** Replay failed events from Inngest dashboard with 1 click

## Dependencies

```bash
npm install inngest
# Dev:
npx inngest-cli@latest dev
```

Single new dependency. No Redis, no workers, no extra infrastructure.
