# Régua Dinâmica — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve DunningStep from fixed execution to intent+resolvers with Manual/Inteligente toggle, engagement event capture, and intelligence dashboard.

**Architecture:** Extend existing Inngest saga (dunning-saga.ts) with resolver layer. Add EngagementEvent model as event store. Batch jobs compute stats that resolvers read. UI adds resolver chips and toggle to existing régua pages.

**Tech Stack:** Next.js 14 (App Router), Prisma/Supabase, Inngest 3.52.6, TypeScript, Tailwind CSS, shadcn/ui, Twilio, Anthropic SDK.

**Spec:** `docs/superpowers/specs/2026-03-11-regua-dinamica-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `prisma/migrations/XXXXXX_regua_dinamica/migration.sql` | Schema migration (auto-generated) |
| `lib/intelligence/resolvers/timing.ts` | Timing resolver (MANUAL/SMART) |
| `lib/intelligence/resolvers/channel.ts` | Channel resolver (MANUAL/SMART) |
| `lib/intelligence/resolvers/content.ts` | Content resolver + variant selection |
| `lib/intelligence/resolvers/types.ts` | Shared types for resolvers |
| `lib/intelligence/stats.ts` | Stats computation logic (used by batch jobs) |
| `inngest/scheduled/refresh-resolver-stats.ts` | Batch: refresh StepResolverStats every 15min |
| `inngest/scheduled/refresh-customer-profiles.ts` | Batch: refresh CustomerEngagementProfile every 6h |
| `inngest/scheduled/evaluate-variants.ts` | Batch: evaluate/deactivate losing variants daily |
| `inngest/functions/capture-engagement.ts` | Inngest function to write EngagementEvents from existing events |
| `app/api/step-variants/route.ts` | CRUD for step variants |
| `app/api/step-variants/generate/route.ts` | Generate variants via Mia (LLM) |
| `app/api/intelligence/stats/route.ts` | GET resolver stats for dashboard |
| `app/api/intelligence/events/route.ts` | GET engagement events (heatmap, channel perf) |
| `components/reguas/resolver-chips.tsx` | Resolver chip components (Manual/Inteligente) |
| `components/reguas/resolver-panels.tsx` | Expanded resolver detail panels |
| `components/reguas/step-editor-modal.tsx` | Step editor modal with resolver toggles |
| `components/reguas/intelligence-banner.tsx` | Intelligence summary banner |
| `app/(dashboard)/reguas/[id]/intelligence/page.tsx` | Intelligence dashboard page |

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add 5 models + 2 enums, extend DunningStep |
| `lib/agent/providers/twilio.ts` | Add statusCallback URL to sendWhatsApp/sendSms |
| `app/api/webhooks/twilio/status/route.ts` | Distinguish READ from DELIVERED, emit new event type |
| `inngest/events.ts` | Add engagement event types |
| `inngest/sagas/dunning-saga.ts` | Insert resolver layer before dispatch |
| `inngest/index.ts` | Register new functions |
| `app/api/dunning-steps/route.ts` | Handle new fields (timingMode, channelMode, contentMode, etc.) |
| `app/(dashboard)/reguas/[id]/page.tsx` | Add resolver chips, expanded panels, intelligence banner |
| `app/(dashboard)/reguas/page.tsx` | Add intelligence banner to rule cards |

---

## Chunk 1: Data Layer (Schema + Events + Engagement Capture)

### Task 1: Extend Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma:213-229` (DunningStep model)
- Modify: `prisma/schema.prisma:280-336` (enums section)

- [ ] **Step 1: Add new enums after existing enums (after line 336)**

```prisma
enum ResolverMode {
  MANUAL
  SMART
}

enum OptimizeMetric {
  PAYMENT
  RESPONSE
  OPEN
}

enum EngagementEventType {
  SENT
  DELIVERED
  READ
  CLICKED
  REPLIED
  PAID
  BOUNCED
  FAILED
}
```

- [ ] **Step 2: Add new fields to DunningStep model (after line 226, before closing brace)**

Add these fields inside the existing DunningStep model:

```prisma
  // Intelligence resolver modes
  timingMode      ResolverMode   @default(MANUAL)
  channelMode     ResolverMode   @default(MANUAL)
  contentMode     ResolverMode   @default(MANUAL)

  // Smart timing config
  fallbackTime    String?        @default("10:00")

  // Smart channel config
  allowedChannels Channel[]      @default([])

  // Smart content config
  optimizeFor     OptimizeMetric @default(PAYMENT)

  // Relations
  variants        StepVariant[]
  resolverStats   StepResolverStats?
  engagementEvents EngagementEvent[]
```

- [ ] **Step 3: Add EngagementEvent model (after NotificationLog model)**

```prisma
model EngagementEvent {
  id             String              @id @default(cuid())
  customerId     String
  customer       Customer            @relation(fields: [customerId], references: [id])
  messageId      String?
  chargeId       String?
  charge         Charge?             @relation(fields: [chargeId], references: [id])
  stepId         String?
  step           DunningStep?        @relation(fields: [stepId], references: [id])
  variantId      String?
  variant        StepVariant?        @relation(fields: [variantId], references: [id])

  channel        Channel
  eventType      EngagementEventType
  occurredAt     DateTime
  metadata       Json?

  franqueadoraId String
  franqueadora   Franqueadora        @relation(fields: [franqueadoraId], references: [id])

  createdAt      DateTime            @default(now())

  @@index([customerId, eventType, occurredAt])
  @@index([stepId, eventType, occurredAt])
  @@index([variantId, eventType])
  @@index([franqueadoraId, occurredAt])
}
```

- [ ] **Step 4: Add StepVariant model**

```prisma
model StepVariant {
  id              String        @id @default(cuid())
  stepId          String
  step            DunningStep   @relation(fields: [stepId], references: [id], onDelete: Cascade)

  label           String
  template        String        @db.Text
  generatedByAi   Boolean       @default(false)
  active          Boolean       @default(true)

  sends           Int           @default(0)
  opens           Int           @default(0)
  replies         Int           @default(0)
  conversions     Int           @default(0)
  openRate        Float         @default(0)
  replyRate       Float         @default(0)
  conversionRate  Float         @default(0)
  isWinner        Boolean       @default(false)

  engagementEvents EngagementEvent[]

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([stepId, label])
}
```

- [ ] **Step 5: Add StepResolverStats model**

```prisma
model StepResolverStats {
  id                String      @id @default(cuid())
  stepId            String      @unique
  step              DunningStep @relation(fields: [stepId], references: [id], onDelete: Cascade)

  bestHourStart     String?
  bestHourEnd       String?
  timingLift        Float?
  timingSamples     Int         @default(0)
  timingConfidence  Float       @default(0)

  bestChannel       Channel?
  channelRates      Json?
  channelLift       Float?
  channelSamples    Int         @default(0)
  channelConfidence Float       @default(0)

  winnerVariantId   String?
  contentLift       Float?
  contentSamples    Int         @default(0)
  contentConfidence Float       @default(0)

  updatedAt         DateTime    @updatedAt
}
```

- [ ] **Step 6: Add CustomerEngagementProfile model**

```prisma
model CustomerEngagementProfile {
  id              String   @id @default(cuid())
  customerId      String   @unique
  customer        Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  bestHour        String?
  avgReadDelayMin Int?
  activeHours     Json?
  bestChannel     Channel?
  channelRates    Json?

  totalMessages   Int      @default(0)
  totalOpens      Int      @default(0)
  totalReplies    Int      @default(0)
  totalPayments   Int      @default(0)
  overallResponseRate Float @default(0)

  updatedAt       DateTime @updatedAt
}
```

- [ ] **Step 7: Add relations to existing models**

Add to Customer model:
```prisma
  engagementEvents   EngagementEvent[]
  engagementProfile  CustomerEngagementProfile?
```

Add to Charge model:
```prisma
  engagementEvents   EngagementEvent[]
```

Add to Franqueadora model:
```prisma
  engagementEvents   EngagementEvent[]
```

- [ ] **Step 8: Run prisma migration**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx prisma migrate dev --name regua_dinamica`

Expected: Migration created and applied successfully.

- [ ] **Step 9: Verify generated client**

Run: `npx prisma generate`

Expected: Prisma Client generated successfully.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add schema for Régua Dinâmica (EngagementEvent, StepVariant, ResolverStats, CustomerProfile)"
```

---

### Task 2: Add Engagement Event Types to Inngest

**Files:**
- Modify: `inngest/events.ts:86-129` (message events section)

- [ ] **Step 1: Add new event types to the events schema**

Add after the existing message events (around line 129):

```typescript
  'engagement/status.received': {
    data: {
      providerMsgId: string
      status: 'delivered' | 'read' | 'failed' | 'undelivered'
      messageId?: string
      customerId?: string
      stepId?: string
      variantId?: string
      channel?: string
      franqueadoraId?: string
    }
  }
  'engagement/payment.received': {
    data: {
      chargeId: string
      customerId: string
      franqueadoraId: string
      amount: number
    }
  }
  'intelligence/stats.refresh': {
    data: {
      franqueadoraId?: string
    }
  }
  'intelligence/profiles.refresh': {
    data: {
      franqueadoraId?: string
    }
  }
  'intelligence/variants.evaluate': {
    data: {
      franqueadoraId?: string
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add inngest/events.ts
git commit -m "feat: add engagement and intelligence event types to Inngest schema"
```

---

### Task 3: Configure Twilio StatusCallback

**Files:**
- Modify: `lib/agent/providers/twilio.ts:26-83`

- [ ] **Step 1: Add WEBHOOK_BASE_URL resolution at top of file**

Add after existing imports (around line 3):

```typescript
function getWebhookBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL
    || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
    || 'http://localhost:3000'
}
```

- [ ] **Step 2: Add statusCallback to sendWhatsApp (line 45)**

In the `client.messages.create()` call inside sendWhatsApp, add the statusCallback parameter:

```typescript
const msg = await client.messages.create({
  from: fromAddr,
  to: `whatsapp:${normalized}`,
  body,
  statusCallback: `${getWebhookBaseUrl()}/api/webhooks/twilio/status`,
})
```

- [ ] **Step 3: Add statusCallback to sendSms (line 76)**

Same change in sendSms:

```typescript
const msg = await client.messages.create({
  from: fromAddr,
  to: normalized,
  body,
  statusCallback: `${getWebhookBaseUrl()}/api/webhooks/twilio/status`,
})
```

- [ ] **Step 4: Commit**

```bash
git add lib/agent/providers/twilio.ts
git commit -m "feat: add statusCallback URL to Twilio message sends"
```

---

### Task 4: Distinguish READ from DELIVERED in Status Webhook

**Files:**
- Modify: `app/api/webhooks/twilio/status/route.ts:18-41`

- [ ] **Step 1: Split READ and DELIVERED into separate event types**

Replace the status handling logic. Currently line 18 treats both `delivered` and `read` as `message/delivered`. Change to:

```typescript
if (messageStatus === 'delivered') {
  await inngest.send({
    name: 'message/delivered',
    data: {
      providerMsgId: messageSid,
      status: 'delivered',
    },
  })
}

if (messageStatus === 'read') {
  await inngest.send({
    name: 'engagement/status.received',
    data: {
      providerMsgId: messageSid,
      status: 'read',
    },
  })
  // Also send delivered event for backwards compatibility
  await inngest.send({
    name: 'message/delivered',
    data: {
      providerMsgId: messageSid,
      status: 'delivered',
    },
  })
}

if (['failed', 'undelivered'].includes(messageStatus)) {
  await inngest.send({
    name: 'message/failed',
    data: {
      providerMsgId: messageSid,
      status: messageStatus,
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/webhooks/twilio/status/route.ts
git commit -m "feat: distinguish READ from DELIVERED in Twilio status webhook"
```

---

### Task 5: Create Engagement Event Capture Function

**Files:**
- Create: `inngest/functions/capture-engagement.ts`

- [ ] **Step 1: Create the capture function**

```typescript
import { inngest } from '../client'
import { prisma } from '@/lib/prisma'

export const captureEngagementFromDelivery = inngest.createFunction(
  { id: 'capture-engagement-delivery', name: 'Capture Engagement: Delivery Status' },
  { event: 'message/delivered' },
  async ({ event, step }) => {
    await step.run('capture', async () => {
      const { providerMsgId } = event.data

      const message = await prisma.message.findFirst({
        where: { externalId: providerMsgId },
        include: {
          conversation: {
            include: { customer: true }
          }
        }
      })

      if (!message || !message.conversation?.customer) return

      const customer = message.conversation.customer

      await prisma.engagementEvent.create({
        data: {
          customerId: customer.id,
          messageId: message.id,
          channel: message.channel || 'WHATSAPP',
          eventType: 'DELIVERED',
          occurredAt: new Date(),
          metadata: { providerMsgId },
          franqueadoraId: customer.franqueadoraId,
        }
      })
    })
  }
)

export const captureEngagementFromRead = inngest.createFunction(
  { id: 'capture-engagement-read', name: 'Capture Engagement: Read Status' },
  { event: 'engagement/status.received' },
  async ({ event, step }) => {
    if (event.data.status !== 'read') return

    await step.run('capture', async () => {
      const { providerMsgId } = event.data

      const message = await prisma.message.findFirst({
        where: { externalId: providerMsgId },
        include: {
          conversation: {
            include: { customer: true }
          }
        }
      })

      if (!message || !message.conversation?.customer) return

      const customer = message.conversation.customer

      await prisma.engagementEvent.create({
        data: {
          customerId: customer.id,
          messageId: message.id,
          channel: message.channel || 'WHATSAPP',
          eventType: 'READ',
          occurredAt: new Date(),
          metadata: { providerMsgId },
          franqueadoraId: customer.franqueadoraId,
        }
      })
    })
  }
)

export const captureEngagementFromReply = inngest.createFunction(
  { id: 'capture-engagement-reply', name: 'Capture Engagement: Inbound Reply' },
  { event: 'inbound/received' },
  async ({ event, step }) => {
    await step.run('capture', async () => {
      const { customerId, franqueadoraId, channel } = event.data
      if (!customerId || !franqueadoraId) return

      await prisma.engagementEvent.create({
        data: {
          customerId,
          channel: channel || 'WHATSAPP',
          eventType: 'REPLIED',
          occurredAt: new Date(),
          franqueadoraId,
        }
      })
    })
  }
)

export const captureEngagementFromPayment = inngest.createFunction(
  { id: 'capture-engagement-payment', name: 'Capture Engagement: Payment' },
  { event: 'charge/paid' },
  async ({ event, step }) => {
    await step.run('capture', async () => {
      const { chargeId } = event.data

      const charge = await prisma.charge.findUnique({
        where: { id: chargeId },
        include: { customer: true }
      })

      if (!charge) return

      await prisma.engagementEvent.create({
        data: {
          customerId: charge.customerId,
          chargeId: charge.id,
          channel: 'WHATSAPP', // will be enriched later
          eventType: 'PAID',
          occurredAt: new Date(),
          franqueadoraId: charge.customer.franqueadoraId,
        }
      })
    })
  }
)
```

- [ ] **Step 2: Register functions in inngest/index.ts**

Add imports and include in allFunctions array:

```typescript
import {
  captureEngagementFromDelivery,
  captureEngagementFromRead,
  captureEngagementFromReply,
  captureEngagementFromPayment,
} from './functions/capture-engagement'
```

Add to the allFunctions array:
```typescript
captureEngagementFromDelivery,
captureEngagementFromRead,
captureEngagementFromReply,
captureEngagementFromPayment,
```

- [ ] **Step 3: Commit**

```bash
git add inngest/functions/capture-engagement.ts inngest/index.ts
git commit -m "feat: add engagement event capture from delivery, read, reply, and payment"
```

---

## Chunk 2: Resolvers + Dunning Saga Integration

### Task 6: Create Resolver Types

**Files:**
- Create: `lib/intelligence/resolvers/types.ts`

- [ ] **Step 1: Create resolver types**

```typescript
import { Channel, ResolverMode, OptimizeMetric } from '@prisma/client'

export interface ResolverContext {
  customerId: string
  stepId: string
  chargeId: string
  franqueadoraId: string
}

export interface TimingResult {
  scheduledHour: string // "HH:MM"
  source: 'manual' | 'profile' | 'step_stats'
}

export interface ChannelResult {
  channel: Channel
  source: 'manual' | 'profile' | 'step_stats'
}

export interface ContentResult {
  template: string
  variantId: string | null
  variantLabel: string | null
  source: 'manual' | 'variant'
}

export interface StepResolution {
  timing: TimingResult
  channel: ChannelResult
  content: ContentResult
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/intelligence/resolvers/types.ts
git commit -m "feat: add resolver type definitions"
```

---

### Task 7: Implement Timing Resolver

**Files:**
- Create: `lib/intelligence/resolvers/timing.ts`

- [ ] **Step 1: Create timing resolver**

```typescript
import { prisma } from '@/lib/prisma'
import { ResolverMode } from '@prisma/client'
import { ResolverContext, TimingResult } from './types'

interface TimingConfig {
  mode: ResolverMode
  fallbackTime: string | null
  offsetDays: number
}

export async function resolveTiming(
  config: TimingConfig,
  ctx: ResolverContext
): Promise<TimingResult> {
  if (config.mode === 'MANUAL') {
    return {
      scheduledHour: config.fallbackTime || '10:00',
      source: 'manual',
    }
  }

  // SMART mode: check customer profile first
  const profile = await prisma.customerEngagementProfile.findUnique({
    where: { customerId: ctx.customerId },
  })

  if (profile?.bestHour) {
    return {
      scheduledHour: profile.bestHour,
      source: 'profile',
    }
  }

  // Fallback: check step-level stats
  const stats = await prisma.stepResolverStats.findUnique({
    where: { stepId: ctx.stepId },
  })

  if (stats?.bestHourStart) {
    return {
      scheduledHour: stats.bestHourStart,
      source: 'step_stats',
    }
  }

  // No data yet — use fallback
  return {
    scheduledHour: config.fallbackTime || '10:00',
    source: 'manual',
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/intelligence/resolvers/timing.ts
git commit -m "feat: implement timing resolver (MANUAL/SMART)"
```

---

### Task 8: Implement Channel Resolver

**Files:**
- Create: `lib/intelligence/resolvers/channel.ts`

- [ ] **Step 1: Create channel resolver**

```typescript
import { prisma } from '@/lib/prisma'
import { Channel, ResolverMode } from '@prisma/client'
import { ResolverContext, ChannelResult } from './types'

interface ChannelConfig {
  mode: ResolverMode
  fixedChannel: Channel
  allowedChannels: Channel[]
}

export async function resolveChannel(
  config: ChannelConfig,
  ctx: ResolverContext
): Promise<ChannelResult> {
  if (config.mode === 'MANUAL') {
    return {
      channel: config.fixedChannel,
      source: 'manual',
    }
  }

  const allowed = config.allowedChannels.length > 0
    ? config.allowedChannels
    : [config.fixedChannel]

  // SMART: check customer profile
  const profile = await prisma.customerEngagementProfile.findUnique({
    where: { customerId: ctx.customerId },
  })

  if (profile?.bestChannel && allowed.includes(profile.bestChannel)) {
    return {
      channel: profile.bestChannel,
      source: 'profile',
    }
  }

  // Fallback: check step-level stats
  const stats = await prisma.stepResolverStats.findUnique({
    where: { stepId: ctx.stepId },
  })

  if (stats?.bestChannel && allowed.includes(stats.bestChannel)) {
    return {
      channel: stats.bestChannel,
      source: 'step_stats',
    }
  }

  // No data — use fixed channel
  return {
    channel: config.fixedChannel,
    source: 'manual',
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/intelligence/resolvers/channel.ts
git commit -m "feat: implement channel resolver (MANUAL/SMART)"
```

---

### Task 9: Implement Content Resolver

**Files:**
- Create: `lib/intelligence/resolvers/content.ts`

- [ ] **Step 1: Create content resolver with weighted random selection**

```typescript
import { prisma } from '@/lib/prisma'
import { ResolverMode, OptimizeMetric, StepVariant } from '@prisma/client'
import { ResolverContext, ContentResult } from './types'

interface ContentConfig {
  mode: ResolverMode
  fixedTemplate: string
  optimizeFor: OptimizeMetric
  stepId: string
}

function getRate(variant: StepVariant, metric: OptimizeMetric): number {
  switch (metric) {
    case 'PAYMENT': return variant.conversionRate
    case 'RESPONSE': return variant.replyRate
    case 'OPEN': return variant.openRate
  }
}

function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total === 0) return items[Math.floor(Math.random() * items.length)]

  let random = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    random -= weights[i]
    if (random <= 0) return items[i]
  }
  return items[items.length - 1]
}

export async function resolveContent(
  config: ContentConfig,
  ctx: ResolverContext
): Promise<ContentResult> {
  if (config.mode === 'MANUAL') {
    return {
      template: config.fixedTemplate,
      variantId: null,
      variantLabel: null,
      source: 'manual',
    }
  }

  // SMART: select from active variants
  const variants = await prisma.stepVariant.findMany({
    where: { stepId: config.stepId, active: true },
  })

  if (variants.length === 0) {
    return {
      template: config.fixedTemplate,
      variantId: null,
      variantLabel: null,
      source: 'manual',
    }
  }

  if (variants.length === 1) {
    return {
      template: variants[0].template,
      variantId: variants[0].id,
      variantLabel: variants[0].label,
      source: 'variant',
    }
  }

  // Weighted random: explore new variants, exploit proven ones
  const weights = variants.map(v => {
    if (v.sends < 100) return 1 // exploration: equal weight for new variants
    return getRate(v, config.optimizeFor) + 0.05 // 5% floor
  })

  const selected = weightedRandom(variants, weights)

  return {
    template: selected.template,
    variantId: selected.id,
    variantLabel: selected.label,
    source: 'variant',
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/intelligence/resolvers/content.ts
git commit -m "feat: implement content resolver with weighted random variant selection"
```

---

### Task 10: Integrate Resolvers into Dunning Saga

**Files:**
- Modify: `inngest/sagas/dunning-saga.ts:79-236` (step loop)

- [ ] **Step 1: Add resolver imports at top of dunning-saga.ts**

```typescript
import { resolveTiming } from '@/lib/intelligence/resolvers/timing'
import { resolveChannel } from '@/lib/intelligence/resolvers/channel'
import { resolveContent } from '@/lib/intelligence/resolvers/content'
import { ResolverContext } from '@/lib/intelligence/resolvers/types'
```

- [ ] **Step 2: Add resolver step before dispatch in the step loop**

Inside the for-each-dunningStep loop (after the AI decision and before the dispatch), add a resolver step. Insert after the SEND_COLLECTION check (around line 157) and before the prepare-dispatch step:

```typescript
// Resolve timing, channel, and content
const resolution = await step.run(`resolve-${dunningStep.id}`, async () => {
  const resolverCtx: ResolverContext = {
    customerId: charge.customerId,
    stepId: dunningStep.id,
    chargeId: charge.id,
    franqueadoraId,
  }

  const timing = await resolveTiming({
    mode: dunningStep.timingMode,
    fallbackTime: dunningStep.fallbackTime,
    offsetDays: dunningStep.offsetDays,
  }, resolverCtx)

  const channel = await resolveChannel({
    mode: dunningStep.channelMode,
    fixedChannel: dunningStep.channel,
    allowedChannels: dunningStep.allowedChannels,
  }, resolverCtx)

  const content = await resolveContent({
    mode: dunningStep.contentMode,
    fixedTemplate: dunningStep.template,
    optimizeFor: dunningStep.optimizeFor,
    stepId: dunningStep.id,
  }, resolverCtx)

  return { timing, channel, content }
})
```

- [ ] **Step 3: Use resolution values in dispatch**

In the prepare-dispatch step, replace hardcoded channel/template with resolved values:

- Replace `dunningStep.channel` with `resolution.channel.channel`
- Replace `dunningStep.template` (rendered message) with `resolution.content.template`
- Use `resolution.timing.scheduledHour` for scheduling (combine with step offsetDays date)
- Store `resolution.content.variantId` in message metadata for tracking

- [ ] **Step 4: Track variant sends**

After dispatch, if variantId exists, increment the variant's send count:

```typescript
if (resolution.content.variantId) {
  await step.run(`track-variant-${dunningStep.id}`, async () => {
    await prisma.stepVariant.update({
      where: { id: resolution.content.variantId! },
      data: { sends: { increment: 1 } },
    })
  })
}
```

- [ ] **Step 5: Commit**

```bash
git add inngest/sagas/dunning-saga.ts
git commit -m "feat: integrate timing/channel/content resolvers into dunning saga"
```

---

## Chunk 3: Batch Intelligence Jobs

### Task 11: Create Stats Computation Logic

**Files:**
- Create: `lib/intelligence/stats.ts`

- [ ] **Step 1: Create stats computation functions**

```typescript
import { prisma } from '@/lib/prisma'
import { Channel, EngagementEventType } from '@prisma/client'

export async function computeStepStats(stepId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Timing: group READ events by hour
  const readEvents = await prisma.engagementEvent.findMany({
    where: {
      stepId,
      eventType: 'READ',
      occurredAt: { gte: thirtyDaysAgo },
    },
    select: { occurredAt: true },
  })

  let bestHourStart: string | null = null
  let bestHourEnd: string | null = null
  let timingLift = 0

  if (readEvents.length >= 50) {
    const hourBuckets: Record<number, number> = {}
    for (const event of readEvents) {
      const hour = event.occurredAt.getHours()
      hourBuckets[hour] = (hourBuckets[hour] || 0) + 1
    }

    const bestHour = Object.entries(hourBuckets)
      .sort(([, a], [, b]) => b - a)[0]

    if (bestHour) {
      const hour = parseInt(bestHour[0])
      bestHourStart = `${hour.toString().padStart(2, '0')}:00`
      bestHourEnd = `${(hour + 1).toString().padStart(2, '0')}:00`
      const avgRate = readEvents.length / Object.keys(hourBuckets).length
      timingLift = bestHour[1] > avgRate ? (bestHour[1] - avgRate) / avgRate : 0
    }
  }

  // Channel: group REPLIED events by channel
  const channelEvents = await prisma.engagementEvent.groupBy({
    by: ['channel'],
    where: {
      stepId,
      eventType: { in: ['REPLIED', 'SENT'] },
      occurredAt: { gte: thirtyDaysAgo },
    },
    _count: { eventType: true },
  })

  const sentByChannel: Record<string, number> = {}
  const repliedByChannel: Record<string, number> = {}

  const sentEvents = await prisma.engagementEvent.groupBy({
    by: ['channel'],
    where: { stepId, eventType: 'SENT', occurredAt: { gte: thirtyDaysAgo } },
    _count: true,
  })

  const replyEvents = await prisma.engagementEvent.groupBy({
    by: ['channel'],
    where: { stepId, eventType: 'REPLIED', occurredAt: { gte: thirtyDaysAgo } },
    _count: true,
  })

  for (const e of sentEvents) sentByChannel[e.channel] = e._count
  for (const e of replyEvents) repliedByChannel[e.channel] = e._count

  const channelRates: Record<string, number> = {}
  let bestChannel: Channel | null = null
  let bestRate = 0

  for (const ch of Object.keys(sentByChannel)) {
    const sent = sentByChannel[ch] || 0
    const replied = repliedByChannel[ch] || 0
    const rate = sent > 0 ? replied / sent : 0
    channelRates[ch] = Math.round(rate * 100) / 100

    if (rate > bestRate) {
      bestRate = rate
      bestChannel = ch as Channel
    }
  }

  // Variant stats
  const variants = await prisma.stepVariant.findMany({
    where: { stepId, active: true },
  })

  let winnerVariantId: string | null = null
  let bestConversion = 0

  for (const v of variants) {
    if (v.conversionRate > bestConversion && v.sends >= 50) {
      bestConversion = v.conversionRate
      winnerVariantId = v.id
    }
  }

  // Update winner flag
  if (winnerVariantId) {
    await prisma.stepVariant.updateMany({
      where: { stepId },
      data: { isWinner: false },
    })
    await prisma.stepVariant.update({
      where: { id: winnerVariantId },
      data: { isWinner: true },
    })
  }

  const totalSamples = readEvents.length + sentEvents.reduce((s, e) => s + e._count, 0)

  await prisma.stepResolverStats.upsert({
    where: { stepId },
    create: {
      stepId,
      bestHourStart,
      bestHourEnd,
      timingLift,
      timingSamples: readEvents.length,
      timingConfidence: Math.min(readEvents.length / 500, 1),
      bestChannel,
      channelRates,
      channelLift: bestRate > 0 ? bestRate : null,
      channelSamples: sentEvents.reduce((s, e) => s + e._count, 0),
      channelConfidence: Math.min(sentEvents.reduce((s, e) => s + e._count, 0) / 500, 1),
      winnerVariantId,
      contentSamples: variants.reduce((s, v) => s + v.sends, 0),
      contentConfidence: winnerVariantId ? Math.min(variants.reduce((s, v) => s + v.sends, 0) / 1000, 1) : 0,
    },
    update: {
      bestHourStart,
      bestHourEnd,
      timingLift,
      timingSamples: readEvents.length,
      timingConfidence: Math.min(readEvents.length / 500, 1),
      bestChannel,
      channelRates,
      channelLift: bestRate > 0 ? bestRate : null,
      channelSamples: sentEvents.reduce((s, e) => s + e._count, 0),
      channelConfidence: Math.min(sentEvents.reduce((s, e) => s + e._count, 0) / 500, 1),
      winnerVariantId,
      contentSamples: variants.reduce((s, v) => s + v.sends, 0),
      contentConfidence: winnerVariantId ? Math.min(variants.reduce((s, v) => s + v.sends, 0) / 1000, 1) : 0,
    },
  })
}

export async function computeCustomerProfile(customerId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const events = await prisma.engagementEvent.findMany({
    where: {
      customerId,
      occurredAt: { gte: thirtyDaysAgo },
    },
    select: { eventType: true, channel: true, occurredAt: true },
  })

  if (events.length === 0) return

  // Best hour
  const readEvents = events.filter(e => e.eventType === 'READ')
  const hourCounts: Record<number, number> = {}
  for (const e of readEvents) {
    const hour = e.occurredAt.getHours()
    hourCounts[hour] = (hourCounts[hour] || 0) + 1
  }

  const bestHourEntry = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]
  const bestHour = bestHourEntry ? `${bestHourEntry[0].padStart(2, '0')}:00` : null

  // Best channel
  const sentByChannel: Record<string, number> = {}
  const repliedByChannel: Record<string, number> = {}

  for (const e of events) {
    if (e.eventType === 'SENT') sentByChannel[e.channel] = (sentByChannel[e.channel] || 0) + 1
    if (e.eventType === 'REPLIED') repliedByChannel[e.channel] = (repliedByChannel[e.channel] || 0) + 1
  }

  let bestChannel: Channel | null = null
  let bestRate = 0
  const channelRates: Record<string, number> = {}

  for (const ch of Object.keys(sentByChannel)) {
    const rate = sentByChannel[ch] > 0 ? (repliedByChannel[ch] || 0) / sentByChannel[ch] : 0
    channelRates[ch] = Math.round(rate * 100) / 100
    if (rate > bestRate) {
      bestRate = rate
      bestChannel = ch as Channel
    }
  }

  const totalMessages = events.filter(e => e.eventType === 'SENT').length
  const totalOpens = readEvents.length
  const totalReplies = events.filter(e => e.eventType === 'REPLIED').length
  const totalPayments = events.filter(e => e.eventType === 'PAID').length

  await prisma.customerEngagementProfile.upsert({
    where: { customerId },
    create: {
      customerId,
      bestHour,
      activeHours: hourCounts,
      bestChannel,
      channelRates,
      totalMessages,
      totalOpens,
      totalReplies,
      totalPayments,
      overallResponseRate: totalMessages > 0 ? totalReplies / totalMessages : 0,
    },
    update: {
      bestHour,
      activeHours: hourCounts,
      bestChannel,
      channelRates,
      totalMessages,
      totalOpens,
      totalReplies,
      totalPayments,
      overallResponseRate: totalMessages > 0 ? totalReplies / totalMessages : 0,
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/intelligence/stats.ts
git commit -m "feat: add stats computation logic for step resolvers and customer profiles"
```

---

### Task 12: Create Batch Inngest Jobs

**Files:**
- Create: `inngest/scheduled/refresh-resolver-stats.ts`
- Create: `inngest/scheduled/refresh-customer-profiles.ts`
- Create: `inngest/scheduled/evaluate-variants.ts`

- [ ] **Step 1: Create refresh-resolver-stats (every 15 min)**

```typescript
import { inngest } from '../client'
import { prisma } from '@/lib/prisma'
import { computeStepStats } from '@/lib/intelligence/stats'

export const refreshResolverStats = inngest.createFunction(
  { id: 'refresh-resolver-stats', name: 'Intelligence: Refresh Step Stats' },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    const steps = await step.run('find-smart-steps', async () => {
      return prisma.dunningStep.findMany({
        where: {
          enabled: true,
          OR: [
            { timingMode: 'SMART' },
            { channelMode: 'SMART' },
            { contentMode: 'SMART' },
          ],
        },
        select: { id: true },
      })
    })

    for (const s of steps) {
      await step.run(`compute-${s.id}`, () => computeStepStats(s.id))
    }

    return { stepsProcessed: steps.length }
  }
)
```

- [ ] **Step 2: Create refresh-customer-profiles (every 6h)**

```typescript
import { inngest } from '../client'
import { prisma } from '@/lib/prisma'
import { computeCustomerProfile } from '@/lib/intelligence/stats'

export const refreshCustomerProfiles = inngest.createFunction(
  { id: 'refresh-customer-profiles', name: 'Intelligence: Refresh Customer Profiles' },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

    const customerIds = await step.run('find-active-customers', async () => {
      const events = await prisma.engagementEvent.findMany({
        where: { createdAt: { gte: sixHoursAgo } },
        select: { customerId: true },
        distinct: ['customerId'],
      })
      return events.map(e => e.customerId)
    })

    const BATCH_SIZE = 100
    for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
      const batch = customerIds.slice(i, i + BATCH_SIZE)
      await step.run(`profiles-batch-${i}`, async () => {
        for (const customerId of batch) {
          await computeCustomerProfile(customerId)
        }
      })
    }

    return { customersProcessed: customerIds.length }
  }
)
```

- [ ] **Step 3: Create evaluate-variants (daily at 4am)**

```typescript
import { inngest } from '../client'
import { prisma } from '@/lib/prisma'

export const evaluateVariants = inngest.createFunction(
  { id: 'evaluate-variants', name: 'Intelligence: Evaluate Variant Performance' },
  { cron: '0 4 * * *' },
  async ({ step }) => {
    const steps = await step.run('find-smart-content-steps', async () => {
      return prisma.dunningStep.findMany({
        where: { enabled: true, contentMode: 'SMART' },
        include: { variants: { where: { active: true } } },
      })
    })

    let deactivated = 0

    for (const s of steps) {
      if (s.variants.length <= 1) continue

      await step.run(`evaluate-${s.id}`, async () => {
        const winner = s.variants.find(v => v.isWinner)
        if (!winner || winner.sends < 200) return

        for (const v of s.variants) {
          if (v.id === winner.id) continue
          if (v.sends < 500) continue

          // Deactivate if less than 50% of winner's conversion rate
          if (v.conversionRate < winner.conversionRate * 0.5) {
            await prisma.stepVariant.update({
              where: { id: v.id },
              data: { active: false },
            })
            deactivated++
          }
        }
      })
    }

    return { stepsEvaluated: steps.length, variantsDeactivated: deactivated }
  }
)
```

- [ ] **Step 4: Register all batch jobs in inngest/index.ts**

Add imports and include in allFunctions:

```typescript
import { refreshResolverStats } from './scheduled/refresh-resolver-stats'
import { refreshCustomerProfiles } from './scheduled/refresh-customer-profiles'
import { evaluateVariants } from './scheduled/evaluate-variants'
```

- [ ] **Step 5: Commit**

```bash
git add inngest/scheduled/refresh-resolver-stats.ts inngest/scheduled/refresh-customer-profiles.ts inngest/scheduled/evaluate-variants.ts inngest/index.ts
git commit -m "feat: add batch intelligence jobs (stats refresh, profile refresh, variant evaluation)"
```

---

## Chunk 4: API Endpoints

### Task 13: Update Dunning Steps API

**Files:**
- Modify: `app/api/dunning-steps/route.ts`

- [ ] **Step 1: Update POST handler to accept new fields**

In the POST body parsing, add the new fields:

```typescript
const {
  ruleId, trigger, offsetDays, channel, template, enabled, phase,
  // New intelligence fields
  timingMode, channelMode, contentMode,
  fallbackTime, allowedChannels, optimizeFor,
} = await req.json()
```

Include them in the prisma.dunningStep.create data:

```typescript
data: {
  ruleId, trigger, offsetDays, channel, template, enabled, phase,
  ...(timingMode && { timingMode }),
  ...(channelMode && { channelMode }),
  ...(contentMode && { contentMode }),
  ...(fallbackTime && { fallbackTime }),
  ...(allowedChannels && { allowedChannels }),
  ...(optimizeFor && { optimizeFor }),
}
```

- [ ] **Step 2: Add PATCH handler for updating step intelligence settings**

Create a new file `app/api/dunning-steps/[id]/route.ts` if it doesn't exist, or add PATCH to it:

```typescript
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { timingMode, channelMode, contentMode, fallbackTime, allowedChannels, optimizeFor } = body

  const step = await prisma.dunningStep.update({
    where: { id: params.id },
    data: {
      ...(timingMode !== undefined && { timingMode }),
      ...(channelMode !== undefined && { channelMode }),
      ...(contentMode !== undefined && { contentMode }),
      ...(fallbackTime !== undefined && { fallbackTime }),
      ...(allowedChannels !== undefined && { allowedChannels }),
      ...(optimizeFor !== undefined && { optimizeFor }),
    },
    include: { variants: true, resolverStats: true },
  })

  return NextResponse.json(step)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/dunning-steps/
git commit -m "feat: update dunning steps API to handle intelligence fields"
```

---

### Task 14: Create Step Variants API

**Files:**
- Create: `app/api/step-variants/route.ts`
- Create: `app/api/step-variants/generate/route.ts`

- [ ] **Step 1: Create CRUD for variants**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const stepId = searchParams.get('stepId')
  if (!stepId) return NextResponse.json({ error: 'stepId required' }, { status: 400 })

  const variants = await prisma.stepVariant.findMany({
    where: { stepId },
    orderBy: { label: 'asc' },
  })

  return NextResponse.json(variants)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stepId, label, template, generatedByAi } = await req.json()

  const variant = await prisma.stepVariant.create({
    data: { stepId, label, template, generatedByAi: generatedByAi || false },
  })

  return NextResponse.json(variant, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.stepVariant.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Create variant generation endpoint (Mia)**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stepId, count = 3, context } = await req.json()

  const step = await prisma.dunningStep.findUnique({
    where: { id: stepId },
    include: { rule: true, variants: true },
  })

  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 })

  const existingTemplates = step.variants.map(v => v.template).join('\n---\n')

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Você é uma especialista em cobrança chamada Mia. Gere ${count} variantes de mensagem de cobrança para o seguinte contexto:

- Fase: ${step.phase}
- Canal: ${step.channel}
- Dia relativo ao vencimento: D${step.offsetDays >= 0 ? '+' : ''}${step.offsetDays}
- Perfil de risco: ${step.rule.riskProfile}
${context ? `- Contexto adicional: ${context}` : ''}

Variáveis disponíveis: {{nome}}, {{valor}}, {{vencimento}}, {{link_boleto}}, {{descricao}}

${existingTemplates ? `Variantes já existentes (gere versões DIFERENTES):\n${existingTemplates}` : ''}

Retorne APENAS as mensagens, uma por linha, separadas por ---. Sem numeração, sem explicação.
${step.channel === 'SMS' ? 'Máximo 160 caracteres cada.' : step.channel === 'WHATSAPP' ? 'Máximo 300 caracteres cada.' : 'Máximo 500 palavras cada.'}`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const templates = text.split('---').map(t => t.trim()).filter(Boolean)

  const existingLabels = step.variants.map(v => v.label)
  const nextLabels = 'ABCDEFGH'.split('').filter(l => !existingLabels.includes(l))

  const created = []
  for (let i = 0; i < Math.min(templates.length, nextLabels.length); i++) {
    const variant = await prisma.stepVariant.create({
      data: {
        stepId,
        label: nextLabels[i],
        template: templates[i],
        generatedByAi: true,
      },
    })
    created.push(variant)
  }

  return NextResponse.json(created, { status: 201 })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/step-variants/
git commit -m "feat: add step variants CRUD and AI generation endpoint"
```

---

### Task 15: Create Intelligence Stats API

**Files:**
- Create: `app/api/intelligence/stats/route.ts`
- Create: `app/api/intelligence/events/route.ts`

- [ ] **Step 1: Create stats endpoint**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFranqueadoraHeaders } from '@/lib/auth'

export async function GET(req: Request) {
  const { franqueadoraId } = getFranqueadoraHeaders(req)
  if (!franqueadoraId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ruleId = searchParams.get('ruleId')

  const steps = await prisma.dunningStep.findMany({
    where: {
      rule: { franqueadoraId, ...(ruleId ? { id: ruleId } : {}) },
      enabled: true,
    },
    include: {
      resolverStats: true,
      variants: { where: { active: true }, orderBy: { conversionRate: 'desc' } },
    },
    orderBy: [{ trigger: 'asc' }, { offsetDays: 'asc' }],
  })

  const smartSteps = steps.filter(s =>
    s.timingMode === 'SMART' || s.channelMode === 'SMART' || s.contentMode === 'SMART'
  )

  // Aggregate KPIs
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [totalSent, totalPaid] = await Promise.all([
    prisma.engagementEvent.count({
      where: { franqueadoraId, eventType: 'SENT', occurredAt: { gte: thirtyDaysAgo } },
    }),
    prisma.engagementEvent.count({
      where: { franqueadoraId, eventType: 'PAID', occurredAt: { gte: thirtyDaysAgo } },
    }),
  ])

  return NextResponse.json({
    steps,
    kpis: {
      totalSteps: steps.length,
      smartSteps: smartSteps.length,
      totalSent,
      totalPaid,
      recoveryRate: totalSent > 0 ? totalPaid / totalSent : 0,
    },
  })
}
```

- [ ] **Step 2: Create events endpoint (for heatmap and channel charts)**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFranqueadoraHeaders } from '@/lib/auth'

export async function GET(req: Request) {
  const { franqueadoraId } = getFranqueadoraHeaders(req)
  if (!franqueadoraId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const stepId = searchParams.get('stepId')
  const type = searchParams.get('type') // 'heatmap' | 'channels'

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  if (type === 'heatmap' && stepId) {
    const events = await prisma.engagementEvent.findMany({
      where: {
        stepId,
        eventType: 'READ',
        occurredAt: { gte: thirtyDaysAgo },
      },
      select: { occurredAt: true },
    })

    // Build heatmap: day of week × hour
    const heatmap: Record<string, Record<string, number>> = {}
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    for (const e of events) {
      const day = days[e.occurredAt.getDay()]
      const hour = e.occurredAt.getHours().toString()
      if (!heatmap[day]) heatmap[day] = {}
      heatmap[day][hour] = (heatmap[day][hour] || 0) + 1
    }

    return NextResponse.json({ heatmap, totalEvents: events.length })
  }

  if (type === 'channels' && stepId) {
    const sent = await prisma.engagementEvent.groupBy({
      by: ['channel'],
      where: { stepId, eventType: 'SENT', occurredAt: { gte: thirtyDaysAgo } },
      _count: true,
    })

    const replied = await prisma.engagementEvent.groupBy({
      by: ['channel'],
      where: { stepId, eventType: 'REPLIED', occurredAt: { gte: thirtyDaysAgo } },
      _count: true,
    })

    const paid = await prisma.engagementEvent.groupBy({
      by: ['channel'],
      where: { stepId, eventType: 'PAID', occurredAt: { gte: thirtyDaysAgo } },
      _count: true,
    })

    return NextResponse.json({ sent, replied, paid })
  }

  return NextResponse.json({ error: 'type and stepId required' }, { status: 400 })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/intelligence/
git commit -m "feat: add intelligence stats and events API endpoints"
```

---

## Chunk 5: Frontend — Components + Pages

### Task 16: Create Resolver Chip Components

**Files:**
- Create: `components/reguas/resolver-chips.tsx`

- [ ] **Step 1: Create the chips component**

```tsx
'use client'

import { ResolverMode } from '@prisma/client'

interface ResolverChipProps {
  icon: string
  mode: ResolverMode
  label: string
  lift?: number | null
  liftLabel?: string
}

export function ResolverChip({ icon, mode, label, lift, liftLabel }: ResolverChipProps) {
  const isManual = mode === 'MANUAL'

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium ${
        isManual
          ? 'bg-gray-50 text-gray-400 border border-gray-100'
          : 'bg-purple-50 text-purple-700 border border-purple-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isManual ? 'bg-gray-300' : 'bg-purple-500'}`} />
      <span>{icon}</span>
      <span>{label}</span>
      {lift != null && lift > 0 && (
        <span className="text-[9px] font-semibold text-emerald-500">
          ↑{Math.round(lift * 100)}% {liftLabel}
        </span>
      )}
    </span>
  )
}

interface ResolverChipRowProps {
  step: {
    timingMode: ResolverMode
    channelMode: ResolverMode
    contentMode: ResolverMode
    fallbackTime?: string | null
    channel: string
    resolverStats?: {
      bestHourStart?: string | null
      timingLift?: number | null
      bestChannel?: string | null
      channelLift?: number | null
      winnerVariantId?: string | null
      contentLift?: number | null
    } | null
    variants?: { label: string; active: boolean }[]
  }
}

export function ResolverChipRow({ step }: ResolverChipRowProps) {
  const stats = step.resolverStats

  const timingLabel = step.timingMode === 'SMART' && stats?.bestHourStart
    ? stats.bestHourStart
    : step.fallbackTime || '10:00'

  const channelLabel = step.channelMode === 'SMART' && stats?.bestChannel
    ? stats.bestChannel
    : step.channel

  const activeVariants = step.variants?.filter(v => v.active).length || 0
  const contentLabel = step.contentMode === 'SMART' && activeVariants > 0
    ? `${activeVariants} variante${activeVariants > 1 ? 's' : ''}`
    : '1 template'

  return (
    <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-gray-100 flex-wrap">
      <ResolverChip
        icon="⏰"
        mode={step.timingMode}
        label={step.timingMode === 'SMART' ? `Melhor horário` : timingLabel}
        lift={stats?.timingLift}
        liftLabel="abert."
      />
      <ResolverChip
        icon="📱"
        mode={step.channelMode}
        label={step.channelMode === 'SMART' ? `Melhor canal` : channelLabel}
        lift={stats?.channelLift}
        liftLabel="resp."
      />
      <ResolverChip
        icon="✍️"
        mode={step.contentMode}
        label={contentLabel}
        lift={stats?.contentLift}
        liftLabel="conv."
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/reguas/resolver-chips.tsx
git commit -m "feat: add resolver chip components (Manual/Inteligente indicators)"
```

---

### Task 17: Create Intelligence Banner Component

**Files:**
- Create: `components/reguas/intelligence-banner.tsx`

- [ ] **Step 1: Create the banner**

```tsx
'use client'

interface IntelligenceBannerProps {
  smartStepCount: number
  totalStepCount: number
  recoveryLift?: number
  costReduction?: number
  speedDays?: number
}

export function IntelligenceBanner({
  smartStepCount,
  totalStepCount,
  recoveryLift,
  costReduction,
  speedDays,
}: IntelligenceBannerProps) {
  if (smartStepCount === 0) return null

  return (
    <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200 rounded-2xl p-4 mb-5 flex items-center gap-4">
      <div className="w-9 h-9 bg-purple-500 rounded-lg flex items-center justify-center text-lg shrink-0">
        🧠
      </div>
      <div className="flex-1">
        <h4 className="text-[13px] font-semibold text-purple-600">Inteligência Ativa</h4>
        <p className="text-[11px] text-gray-500">
          {smartStepCount} de {totalStepCount} steps no modo inteligente
        </p>
      </div>
      <div className="flex gap-5">
        {recoveryLift != null && (
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">+{Math.round(recoveryLift * 100)}%</div>
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">Recuperação</div>
          </div>
        )}
        {costReduction != null && (
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">-{Math.round(costReduction * 100)}%</div>
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">Custo/msg</div>
          </div>
        )}
        {speedDays != null && (
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">{speedDays}d</div>
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">Mais rápido</div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/reguas/intelligence-banner.tsx
git commit -m "feat: add intelligence banner component"
```

---

### Task 18: Create Step Editor Modal with Resolver Toggles

**Files:**
- Create: `components/reguas/step-editor-modal.tsx`

This is a large component. It implements the Modal shown in Mockup Tela 2 with Manual/Inteligente toggles for each resolver dimension, variant editor, and "Gerar variantes com Mia" button.

- [ ] **Step 1: Create the modal component**

Create `components/reguas/step-editor-modal.tsx` implementing the full editor with:
- Base config section (offset, phase)
- Timing section with Manual/Inteligente toggle
- Channel section with Manual/Inteligente toggle + channel checkboxes
- Content section with Manual/Inteligente toggle + variant editor
- "Gerar variantes com Mia" button that calls `/api/step-variants/generate`
- Save/Cancel footer

Follow the design language from the mockup: rounded-xl inputs, purple accents for smart mode, gray for manual, smart-result cards showing discovered values.

Reference: `.superpowers/brainstorm/6293-1773256804/mockup-v2-all.html` (Screen 2)

- [ ] **Step 2: Commit**

```bash
git add components/reguas/step-editor-modal.tsx
git commit -m "feat: add step editor modal with Manual/Inteligente resolver toggles"
```

---

### Task 19: Integrate Components into Régua Detail Page

**Files:**
- Modify: `app/(dashboard)/reguas/[id]/page.tsx`

- [ ] **Step 1: Import new components**

```typescript
import { ResolverChipRow } from '@/components/reguas/resolver-chips'
import { IntelligenceBanner } from '@/components/reguas/intelligence-banner'
import { StepEditorModal } from '@/components/reguas/step-editor-modal'
```

- [ ] **Step 2: Update data fetching**

Update the API call to include resolver stats and variants:
- Ensure `/api/dunning-rules/[id]` returns steps with `resolverStats` and `variants` included
- Add a fetch to `/api/intelligence/stats?ruleId=X` for the banner KPIs

- [ ] **Step 3: Add IntelligenceBanner below the page header**

```tsx
<IntelligenceBanner
  smartStepCount={smartSteps.length}
  totalStepCount={steps.length}
/>
```

- [ ] **Step 4: Add ResolverChipRow to each step card**

Inside each step card, after the template preview line, add:

```tsx
<ResolverChipRow step={step} />
```

- [ ] **Step 5: Add step border color based on mode**

```tsx
className={`... ${
  step.timingMode === 'SMART' || step.channelMode === 'SMART' || step.contentMode === 'SMART'
    ? 'border-purple-200'
    : ''
}`}
```

- [ ] **Step 6: Wire edit button to StepEditorModal**

Replace existing inline edit form with the new StepEditorModal.

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/reguas/[id]/page.tsx
git commit -m "feat: integrate intelligence banner and resolver chips into régua detail page"
```

---

### Task 20: Create Intelligence Dashboard Page

**Files:**
- Create: `app/(dashboard)/reguas/[id]/intelligence/page.tsx`

- [ ] **Step 1: Create the intelligence dashboard page**

Implement the page shown in Mockup Tela 3:
- KPI cards (recovery rate, cost, speed, smart steps count)
- Step performance grid (cards per step with Manual/Inteligente badge)
- Heatmap chart (fetch from `/api/intelligence/events?type=heatmap&stepId=X`)
- Channel performance bars (fetch from `/api/intelligence/events?type=channels&stepId=X`)
- Variant performance table (from step data with variants)

Use Recharts for charts where applicable, otherwise CSS-based visualizations matching the mockup.

Reference: `.superpowers/brainstorm/6293-1773256804/mockup-v2-all.html` (Screen 3)

- [ ] **Step 2: Add link to intelligence page from rule detail banner**

In the IntelligenceBanner, add a link:
```tsx
<Link href={`/reguas/${ruleId}/intelligence`} className="text-purple-600 text-xs font-semibold">
  Ver detalhes →
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/reguas/[id]/intelligence/
git commit -m "feat: add intelligence dashboard page with KPIs, heatmap, channel perf, and variant table"
```

---

## Chunk 6: Integration Testing + Final Commit

### Task 21: Verify End-to-End Flow

- [ ] **Step 1: Run prisma generate and verify no type errors**

Run: `npx prisma generate && npx tsc --noEmit`

- [ ] **Step 2: Start dev server and verify pages load**

Run: `npm run dev`

Verify:
- `/reguas` loads without errors
- `/reguas/[id]` shows resolver chips on steps
- Intelligence banner appears when at least 1 step is SMART
- Step editor modal opens with Manual/Inteligente toggles
- `/reguas/[id]/intelligence` loads dashboard

- [ ] **Step 3: Test Inngest functions locally**

Run: `npx inngest-cli dev`

Verify functions registered:
- capture-engagement-delivery
- capture-engagement-read
- capture-engagement-reply
- capture-engagement-payment
- refresh-resolver-stats
- refresh-customer-profiles
- evaluate-variants

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "feat: Régua Dinâmica Fase 1 — complete implementation"
git push -u origin feat/regua-dinamica
```
