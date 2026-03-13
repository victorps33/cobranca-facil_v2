# Batch Communication Engine — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-invoice dunning-saga with a batch communication engine that consolidates messages by debtor.

**Architecture:** Fan-out pipeline via Inngest events: Orchestrator (cron) → Evaluate (per tenant) → Group (per tenant) → Send (per message group). Pure business logic in `lib/batch/`, thin Inngest wrappers in `inngest/functions/` and `inngest/scheduled/`.

**Tech Stack:** Next.js 14, Prisma 5, Inngest v3, TypeScript, Vitest (new), Twilio

**Spec:** `docs/superpowers/specs/2026-03-13-batch-communication-engine-design.md`

---

## Chunk 1: Setup, Schema, Pure Functions

### Task 1: Set up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify setup**

Run: `npm test`
Expected: "No test files found" (no error)

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: set up vitest for unit testing"
```

---

### Task 2: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new enums**

Add after `enum GroupStatus` does not exist yet. Add after `enum NotificationStatus`:

```prisma
enum BatchStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

enum IntentStatus {
  PENDING
  GROUPED
  SENT
  FAILED
  SKIPPED
}

enum GroupStatus {
  PENDING
  READY
  SENT
  FAILED
  SKIPPED
}
```

- [ ] **Step 2: Add BatchRun model**

Add after the enums:

```prisma
model BatchRun {
  id               String        @id @default(cuid())
  franqueadoraId   String
  franqueadora     Franqueadora  @relation(fields: [franqueadoraId], references: [id])
  runDate          DateTime      @db.Date
  status           BatchStatus   @default(PENDING)
  stats            Json?
  startedAt        DateTime?
  completedAt      DateTime?
  createdAt        DateTime      @default(now())

  intents          CommunicationIntent[]
  messageGroups    MessageGroup[]

  @@unique([franqueadoraId, runDate])
  @@index([status])
}
```

- [ ] **Step 3: Add CommunicationIntent model**

```prisma
model CommunicationIntent {
  id             String          @id @default(cuid())
  batchRunId     String
  batchRun       BatchRun        @relation(fields: [batchRunId], references: [id])
  chargeId       String
  charge         Charge          @relation(fields: [chargeId], references: [id])
  customerId     String
  customer       Customer        @relation(fields: [customerId], references: [id])
  stepId         String
  step           DunningStep     @relation(fields: [stepId], references: [id])
  phase          DunningPhase
  channel        Channel
  offsetDays     Int
  status         IntentStatus    @default(PENDING)
  messageGroupId String?
  messageGroup   MessageGroup?   @relation(fields: [messageGroupId], references: [id])
  createdAt      DateTime        @default(now())

  @@unique([chargeId, stepId])
  @@index([batchRunId, status])
  @@index([customerId])
}
```

- [ ] **Step 4: Add MessageGroup model**

```prisma
model MessageGroup {
  id               String          @id @default(cuid())
  batchRunId       String
  batchRun         BatchRun        @relation(fields: [batchRunId], references: [id])
  franqueadoraId   String
  franqueadora     Franqueadora    @relation(fields: [franqueadoraId], references: [id])
  customerId       String
  customer         Customer        @relation(fields: [customerId], references: [id])
  channel          Channel
  recipient        String
  phase            DunningPhase
  status           GroupStatus     @default(PENDING)
  renderedMessage  String?         @db.Text
  sentAt           DateTime?
  createdAt        DateTime        @default(now())

  intents          CommunicationIntent[]

  @@unique([batchRunId, customerId, channel])
  @@index([status])
}
```

- [ ] **Step 5: Add relations to existing models**

In `Charge` model, add:
```prisma
communicationIntents CommunicationIntent[]
```

In `Customer` model, add:
```prisma
communicationIntents CommunicationIntent[]
messageGroups        MessageGroup[]
```

In `DunningStep` model, add:
```prisma
communicationIntents CommunicationIntent[]
```

In `Franqueadora` model, add:
```prisma
batchRuns      BatchRun[]
messageGroups  MessageGroup[]
```

- [ ] **Step 6: Run prisma generate and validate**

Run: `npx prisma generate`
Expected: No errors

Run: `npx prisma db push`
Expected: Schema applied successfully

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add BatchRun, CommunicationIntent, MessageGroup models"
```

---

### Task 3: computeFireDate (TDD)

**Files:**
- Create: `lib/batch/fire-date.ts`
- Create: `lib/batch/fire-date.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/batch/fire-date.test.ts
import { describe, it, expect } from "vitest";
import { computeFireDate } from "./fire-date";

describe("computeFireDate", () => {
  // 2026-03-20 is a Friday
  const dueDate = new Date("2026-03-20");

  describe("BEFORE_DUE", () => {
    it("subtracts 5 business days", () => {
      const result = computeFireDate("BEFORE_DUE", 5, dueDate);
      // 20(Fri) -1→19(Thu) -2→18(Wed) -3→17(Tue) -4→16(Mon) -5→13(Fri)
      expect(result).toEqual(new Date("2026-03-13"));
    });

    it("skips weekends when subtracting", () => {
      // dueDate is Monday 2026-03-16
      const monday = new Date("2026-03-16");
      const result = computeFireDate("BEFORE_DUE", 1, monday);
      // 16(Mon) -1→13(Fri) — skips Sat/Sun
      expect(result).toEqual(new Date("2026-03-13"));
    });

    it("handles offsetDays 0", () => {
      const result = computeFireDate("BEFORE_DUE", 0, dueDate);
      expect(result).toEqual(dueDate);
    });
  });

  describe("ON_DUE", () => {
    it("returns dueDate regardless of offsetDays", () => {
      const result = computeFireDate("ON_DUE", 0, dueDate);
      expect(result).toEqual(dueDate);
    });
  });

  describe("AFTER_DUE", () => {
    it("adds 7 business days", () => {
      const result = computeFireDate("AFTER_DUE", 7, dueDate);
      // 20(Fri) +1→23(Mon) +2→24 +3→25 +4→26 +5→27(Fri) +6→30(Mon) +7→31(Tue)
      expect(result).toEqual(new Date("2026-03-31"));
    });

    it("adds 3 business days from a Thursday", () => {
      const thursday = new Date("2026-03-19");
      const result = computeFireDate("AFTER_DUE", 3, thursday);
      // 19(Thu) +1→20(Fri) +2→23(Mon) +3→24(Tue)
      expect(result).toEqual(new Date("2026-03-24"));
    });

    it("handles offsetDays 0", () => {
      const result = computeFireDate("AFTER_DUE", 0, dueDate);
      expect(result).toEqual(dueDate);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/batch/fire-date.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement computeFireDate**

```typescript
// lib/batch/fire-date.ts
import type { DunningTrigger } from "@prisma/client";

/**
 * Computes the fire date for a dunning step relative to a charge's due date.
 * Counts only business days (Mon-Fri), skipping Sat/Sun.
 * Returns a Date with time set to 00:00:00 for date-only comparison.
 */
export function computeFireDate(
  trigger: DunningTrigger,
  offsetDays: number,
  dueDate: Date
): Date {
  // Normalize to midnight UTC to avoid timezone issues in date comparison
  const result = new Date(
    Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  );

  if (trigger === "ON_DUE" || offsetDays === 0) {
    return result;
  }

  const direction = trigger === "BEFORE_DUE" ? -1 : 1;
  let remaining = offsetDays;

  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + direction);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining--;
    }
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/batch/fire-date.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/batch/fire-date.ts lib/batch/fire-date.test.ts
git commit -m "feat: add computeFireDate with business day calculation"
```

---

### Task 4: Message Renderer (TDD)

**Files:**
- Create: `lib/batch/render.ts`
- Create: `lib/batch/render.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/batch/render.test.ts
import { describe, it, expect } from "vitest";
import { renderConsolidatedMessage, interpolateTemplate, formatBRL } from "./render";

describe("formatBRL", () => {
  it("formats cents to BRL", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
  });

  it("formats zero", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
});

describe("interpolateTemplate", () => {
  it("replaces simple variables", () => {
    const result = interpolateTemplate("Olá {{nome}}, valor {{valor}}", {
      nome: "João",
      valor: "R$ 100,00",
    });
    expect(result).toBe("Olá João, valor R$ 100,00");
  });

  it("leaves unknown variables as-is", () => {
    const result = interpolateTemplate("{{nome}} {{unknown}}", { nome: "João" });
    expect(result).toBe("João {{unknown}}");
  });
});

describe("renderConsolidatedMessage", () => {
  const customer = { name: "João Silva" };
  const runDate = new Date("2026-03-20");
  const singleCharge = [
    {
      description: "Mensalidade Mar/2026",
      amountCents: 50000,
      dueDate: new Date("2026-03-15"),
      boleto: { publicUrl: "https://boleto.example.com/1" },
    },
  ];

  it("uses step template for single charge", () => {
    const result = renderConsolidatedMessage(
      "WHATSAPP",
      "ATRASO",
      customer,
      singleCharge,
      "Oi {{nome}}, sua fatura de *{{valor}}* vence em *{{vencimento}}*. {{dias_atraso}} dias. Boleto: {{link_boleto}}",
      runDate
    );
    expect(result).toContain("João Silva");
    expect(result).toContain("R$ 500,00");
    expect(result).toContain("15/03/2026");
    expect(result).toContain("5 dias"); // 5 days between 03-15 and 03-20
    expect(result).toContain("https://boleto.example.com/1");
  });

  const multipleCharges = [
    {
      description: "Mensalidade Mar/2026",
      amountCents: 50000,
      dueDate: new Date("2026-03-15"),
      boleto: { publicUrl: "https://boleto.example.com/1" },
    },
    {
      description: "Mensalidade Fev/2026",
      amountCents: 50000,
      dueDate: new Date("2026-02-15"),
      boleto: null,
    },
  ];

  it("renders consolidated message for multiple charges on WhatsApp", () => {
    const result = renderConsolidatedMessage(
      "WHATSAPP",
      "ATRASO",
      customer,
      multipleCharges,
      "ignored template",
      runDate
    );
    expect(result).toContain("João Silva");
    expect(result).toContain("Mensalidade Mar/2026");
    expect(result).toContain("Mensalidade Fev/2026");
    expect(result).toContain("R$ 1.000,00"); // total
  });

  it("renders short SMS for multiple charges", () => {
    const result = renderConsolidatedMessage(
      "SMS",
      "ATRASO",
      customer,
      multipleCharges,
      "ignored",
      runDate
    );
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result).toContain("2 faturas");
    expect(result).toContain("R$ 1.000,00");
  });

  it("renders HTML email for multiple charges", () => {
    const result = renderConsolidatedMessage(
      "EMAIL",
      "ATRASO",
      customer,
      multipleCharges,
      "ignored",
      runDate
    );
    expect(result).toContain("<li>");
    expect(result).toContain("Mensalidade Mar/2026");
    expect(result).toContain("R$ 1.000,00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/batch/render.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement render.ts**

```typescript
// lib/batch/render.ts
import type { Channel, DunningPhase } from "@prisma/client";

export interface ChargeForRender {
  description: string;
  amountCents: number;
  dueDate: Date;
  boleto?: { publicUrl: string } | null;
}

export interface CustomerForRender {
  name: string;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] ?? match;
  });
}

/**
 * Renders the message for a group of charges.
 * - Single charge: interpolates the step's Mustache template.
 * - Multiple charges: generates a consolidated message by channel.
 * @param runDate - The batch's runDate (deterministic, not Date.now()).
 */
export function renderConsolidatedMessage(
  channel: Channel,
  phase: DunningPhase,
  customer: CustomerForRender,
  charges: ChargeForRender[],
  stepTemplate: string,
  runDate: Date
): string {
  const totalCents = charges.reduce((sum, c) => sum + c.amountCents, 0);
  const boletoUrl = charges.find((c) => c.boleto?.publicUrl)?.boleto?.publicUrl ?? "";

  // Single charge: use the step's existing template
  if (charges.length === 1) {
    const charge = charges[0];
    const daysLate = Math.max(
      0,
      Math.floor((new Date(runDate).getTime() - new Date(charge.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    );
    return interpolateTemplate(stepTemplate, {
      nome: customer.name,
      valor: formatBRL(charge.amountCents),
      vencimento: formatDate(charge.dueDate),
      total: formatBRL(totalCents),
      qtd: "1",
      link_boleto: boletoUrl,
      link: boletoUrl,
      dias_atraso: String(daysLate),
      descricao: charge.description,
    });
  }

  // Multiple charges: consolidated template by channel
  if (channel === "SMS") {
    return renderSmsConsolidated(customer, charges, totalCents, boletoUrl);
  }

  if (channel === "EMAIL") {
    return renderEmailConsolidated(customer, charges, totalCents, boletoUrl);
  }

  return renderWhatsappConsolidated(customer, charges, totalCents, boletoUrl);
}

function renderSmsConsolidated(
  customer: CustomerForRender,
  charges: ChargeForRender[],
  totalCents: number,
  boletoUrl: string
): string {
  const earliest = charges.reduce((min, c) =>
    new Date(c.dueDate) < new Date(min.dueDate) ? c : min
  );
  return `${customer.name}, voce tem ${charges.length} faturas em aberto totalizando ${formatBRL(totalCents)}. A mais urgente vence em ${formatDate(earliest.dueDate)}. Regularize: ${boletoUrl}`.slice(0, 160);
}

function renderWhatsappConsolidated(
  customer: CustomerForRender,
  charges: ChargeForRender[],
  totalCents: number,
  boletoUrl: string
): string {
  const lines = charges.map(
    (c) => `• ${c.description} — *${formatBRL(c.amountCents)}* (venc. ${formatDate(c.dueDate)})`
  );

  return [
    `Oi ${customer.name}, você tem faturas em aberto:`,
    "",
    ...lines,
    "",
    `*Total: ${formatBRL(totalCents)}*`,
    "",
    boletoUrl ? `Boleto atualizado: ${boletoUrl}` : "",
    "",
    "Qualquer dúvida, estamos à disposição!",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderEmailConsolidated(
  customer: CustomerForRender,
  charges: ChargeForRender[],
  totalCents: number,
  boletoUrl: string
): string {
  const items = charges.map(
    (c) => `<li>${c.description} — <strong>${formatBRL(c.amountCents)}</strong> (venc. ${formatDate(c.dueDate)})</li>`
  );

  return [
    `<p>Olá ${customer.name}, você tem faturas em aberto:</p>`,
    `<ul>${items.join("")}</ul>`,
    `<p><strong>Total: ${formatBRL(totalCents)}</strong></p>`,
    boletoUrl ? `<p><a href="${boletoUrl}">Boleto atualizado</a></p>` : "",
    `<p>Qualquer dúvida, estamos à disposição!</p>`,
  ]
    .filter(Boolean)
    .join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/batch/render.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/batch/render.ts lib/batch/render.test.ts
git commit -m "feat: add consolidated message renderer with single/multi-charge support"
```

---

## Chunk 2: Pipeline Logic

### Task 5: Evaluate Logic (TDD)

**Files:**
- Create: `lib/batch/evaluate.ts`
- Create: `lib/batch/evaluate.test.ts`

This is the core logic: given charges and rules, determine which step fires for each charge.

- [ ] **Step 1: Write failing tests**

Test the pure function `findNextStep` which takes a charge, its rule's steps, existing intent stepIds, and runDate — returns the step that should fire (or null).

```typescript
// lib/batch/evaluate.test.ts
import { describe, it, expect } from "vitest";
import { findNextStep } from "./evaluate";

// Build test steps matching the default dunning rule structure
const steps = [
  { id: "s1", trigger: "BEFORE_DUE" as const, offsetDays: 5, channel: "EMAIL" as const, phase: "LEMBRETE" as const },
  { id: "s2", trigger: "BEFORE_DUE" as const, offsetDays: 3, channel: "SMS" as const, phase: "LEMBRETE" as const },
  { id: "s3", trigger: "BEFORE_DUE" as const, offsetDays: 1, channel: "WHATSAPP" as const, phase: "LEMBRETE" as const },
  { id: "s4", trigger: "ON_DUE" as const, offsetDays: 0, channel: "WHATSAPP" as const, phase: "VENCIMENTO" as const },
  { id: "s5", trigger: "AFTER_DUE" as const, offsetDays: 3, channel: "SMS" as const, phase: "ATRASO" as const },
  { id: "s6", trigger: "AFTER_DUE" as const, offsetDays: 7, channel: "WHATSAPP" as const, phase: "ATRASO" as const },
  { id: "s7", trigger: "AFTER_DUE" as const, offsetDays: 10, channel: "LIGACAO" as const, phase: "ATRASO" as const },
];

describe("findNextStep", () => {
  // dueDate: Friday 2026-03-20
  const dueDate = new Date("2026-03-20");

  it("fires BEFORE_DUE step 5 days before due date", () => {
    // runDate = 2026-03-13 (Friday, exactly 5 business days before 03-20)
    const runDate = new Date("2026-03-13");
    const result = findNextStep(steps, dueDate, runDate, []);
    expect(result?.id).toBe("s1"); // EMAIL, BEFORE_DUE, offset 5
  });

  it("fires ON_DUE step on due date", () => {
    const runDate = new Date("2026-03-20");
    // s1, s2, s3 already sent
    const result = findNextStep(steps, dueDate, runDate, ["s1", "s2", "s3"]);
    expect(result?.id).toBe("s4");
  });

  it("fires AFTER_DUE step 3 business days after due", () => {
    // 20(Fri) +3 business days = 25(Wed)
    const runDate = new Date("2026-03-25");
    const result = findNextStep(steps, dueDate, runDate, ["s1", "s2", "s3", "s4"]);
    expect(result?.id).toBe("s5");
  });

  it("returns null when all steps already fired", () => {
    const runDate = new Date("2026-04-15");
    const result = findNextStep(steps, dueDate, runDate, ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
    expect(result).toBeNull();
  });

  it("returns null when no step is due yet", () => {
    const runDate = new Date("2026-03-10"); // too early for any step
    const result = findNextStep(steps, dueDate, runDate, []);
    expect(result).toBeNull();
  });

  it("skips already-fired steps and finds the next one", () => {
    // runDate = 2026-03-17 (Tuesday) — BEFORE_DUE offset 3 fires on 03-17
    const runDate = new Date("2026-03-17");
    // s1 already fired
    const result = findNextStep(steps, dueDate, runDate, ["s1"]);
    expect(result?.id).toBe("s2"); // SMS, BEFORE_DUE, offset 3
  });

  it("AFTER_DUE steps do not fire for PENDING (future-due) charges", () => {
    // charge due 2026-03-20, runDate is 2026-03-18 (before due)
    // AFTER_DUE steps compute fireDate in the future, so they should NOT fire
    const runDate = new Date("2026-03-18");
    const result = findNextStep(steps, dueDate, runDate, ["s1", "s2", "s3"]);
    // s4 is ON_DUE (fires on 03-20), not yet → null
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/batch/evaluate.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement findNextStep**

```typescript
// lib/batch/evaluate.ts
import type { DunningTrigger, DunningPhase, Channel } from "@prisma/client";
import { computeFireDate } from "./fire-date";

export interface EvaluableStep {
  id: string;
  trigger: DunningTrigger;
  offsetDays: number;
  channel: Channel;
  phase: DunningPhase;
}

/**
 * Given a charge's rule steps, its dueDate, today's runDate, and already-fired step IDs,
 * returns the next step that should fire — or null if none.
 *
 * Logic:
 * 1. Compute fireDate for each step
 * 2. Sort by fireDate chronologically
 * 3. Find the first step where: not already fired AND fireDate <= runDate
 */
export function findNextStep(
  steps: EvaluableStep[],
  dueDate: Date,
  runDate: Date,
  firedStepIds: string[]
): EvaluableStep | null {
  const normalizedRunDate = new Date(
    Date.UTC(runDate.getFullYear(), runDate.getMonth(), runDate.getDate())
  );

  const stepsWithFireDate = steps.map((step) => ({
    step,
    fireDate: computeFireDate(step.trigger, step.offsetDays, dueDate),
  }));

  // Sort chronologically by fireDate
  stepsWithFireDate.sort((a, b) => a.fireDate.getTime() - b.fireDate.getTime());

  for (const { step, fireDate } of stepsWithFireDate) {
    if (firedStepIds.includes(step.id)) continue;
    if (fireDate.getTime() <= normalizedRunDate.getTime()) {
      return step;
    }
  }

  return null;
}

// Channel classification helpers
const COMMUNICATION_CHANNELS: Channel[] = ["EMAIL", "SMS", "WHATSAPP"];
const ESCALATION_MAP: Partial<Record<Channel, "NEGATIVACAO" | "PROTESTO" | "JURIDICO">> = {
  BOA_VISTA: "NEGATIVACAO",
  CARTORIO: "PROTESTO",
  JURIDICO: "JURIDICO",
};

export function isCommunicationChannel(channel: Channel): boolean {
  return COMMUNICATION_CHANNELS.includes(channel);
}

export function isEscalationChannel(channel: Channel): channel is "BOA_VISTA" | "CARTORIO" | "JURIDICO" {
  return channel in ESCALATION_MAP;
}

export function getEscalationType(channel: Channel): "NEGATIVACAO" | "PROTESTO" | "JURIDICO" | null {
  return ESCALATION_MAP[channel] ?? null;
}

export function isCallChannel(channel: Channel): boolean {
  return channel === "LIGACAO";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/batch/evaluate.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/batch/evaluate.ts lib/batch/evaluate.test.ts
git commit -m "feat: add findNextStep with channel classification helpers"
```

---

### Task 6: Group Logic (TDD)

**Files:**
- Create: `lib/batch/group.ts`
- Create: `lib/batch/group.test.ts`

Pure functions: group intents by (customerId, channel), resolve recipient, determine max phase.

- [ ] **Step 1: Write failing tests**

```typescript
// lib/batch/group.test.ts
import { describe, it, expect } from "vitest";
import { groupIntentsByRecipient, resolveRecipient, maxPhase } from "./group";

describe("resolveRecipient", () => {
  const customer = { email: "joao@example.com", phone: "11999990000", whatsappPhone: "11888880000" };

  it("resolves EMAIL to email", () => {
    expect(resolveRecipient("EMAIL", customer)).toBe("joao@example.com");
  });

  it("resolves WHATSAPP to whatsappPhone", () => {
    expect(resolveRecipient("WHATSAPP", customer)).toBe("11888880000");
  });

  it("falls back to phone if whatsappPhone is null", () => {
    expect(resolveRecipient("WHATSAPP", { ...customer, whatsappPhone: null })).toBe("11999990000");
  });

  it("resolves SMS to phone", () => {
    expect(resolveRecipient("SMS", customer)).toBe("11999990000");
  });

  it("returns null for empty contact", () => {
    expect(resolveRecipient("EMAIL", { email: "", phone: "", whatsappPhone: null })).toBeNull();
  });
});

describe("maxPhase", () => {
  it("returns the most severe phase", () => {
    expect(maxPhase(["LEMBRETE", "ATRASO", "VENCIMENTO"])).toBe("ATRASO");
  });

  it("handles single phase", () => {
    expect(maxPhase(["LEMBRETE"])).toBe("LEMBRETE");
  });

  it("POS_PROTESTO is the highest", () => {
    expect(maxPhase(["LEMBRETE", "POS_PROTESTO", "ATRASO"])).toBe("POS_PROTESTO");
  });
});

describe("groupIntentsByRecipient", () => {
  it("groups intents by customerId and channel", () => {
    const intents = [
      { customerId: "c1", channel: "EMAIL" as const, phase: "ATRASO" as const },
      { customerId: "c1", channel: "EMAIL" as const, phase: "LEMBRETE" as const },
      { customerId: "c1", channel: "WHATSAPP" as const, phase: "ATRASO" as const },
      { customerId: "c2", channel: "EMAIL" as const, phase: "VENCIMENTO" as const },
    ];
    const groups = groupIntentsByRecipient(intents);

    expect(groups).toHaveLength(3);
    expect(groups.find((g) => g.customerId === "c1" && g.channel === "EMAIL")?.intents).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/batch/group.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement group.ts**

```typescript
// lib/batch/group.ts
import type { Channel, DunningPhase } from "@prisma/client";

export const PHASE_SEVERITY: Record<DunningPhase, number> = {
  LEMBRETE: 0,
  VENCIMENTO: 1,
  ATRASO: 2,
  NEGATIVACAO: 3,
  COBRANCA_INTENSIVA: 4,
  PROTESTO: 5,
  POS_PROTESTO: 6,
};

interface CustomerContact {
  email: string;
  phone: string;
  whatsappPhone: string | null;
}

interface GroupableIntent {
  customerId: string;
  channel: Channel;
  phase: DunningPhase;
}

export interface IntentGroup<T extends GroupableIntent = GroupableIntent> {
  customerId: string;
  channel: Channel;
  intents: T[];
}

export function resolveRecipient(
  channel: Channel,
  customer: CustomerContact
): string | null {
  let value: string | null = null;

  switch (channel) {
    case "EMAIL":
      value = customer.email;
      break;
    case "WHATSAPP":
      value = customer.whatsappPhone || customer.phone;
      break;
    case "SMS":
      value = customer.phone;
      break;
  }

  return value && value.trim().length > 0 ? value : null;
}

export function maxPhase(phases: DunningPhase[]): DunningPhase {
  return phases.reduce((max, phase) =>
    PHASE_SEVERITY[phase] > PHASE_SEVERITY[max] ? phase : max
  );
}

export function groupIntentsByRecipient<T extends GroupableIntent>(
  intents: T[]
): IntentGroup<T>[] {
  const map = new Map<string, IntentGroup<T>>();

  for (const intent of intents) {
    const key = `${intent.customerId}:${intent.channel}`;
    if (!map.has(key)) {
      map.set(key, {
        customerId: intent.customerId,
        channel: intent.channel,
        intents: [],
      });
    }
    map.get(key)!.intents.push(intent);
  }

  return Array.from(map.values());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/batch/group.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/batch/group.ts lib/batch/group.test.ts
git commit -m "feat: add group logic with recipient resolution and phase severity"
```

---

### Task 7: Circuit Breaker (TDD)

**Files:**
- Create: `lib/batch/circuit-breaker.ts`
- Create: `lib/batch/circuit-breaker.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/batch/circuit-breaker.test.ts
import { describe, it, expect } from "vitest";
import { shouldHalt } from "./circuit-breaker";

describe("shouldHalt", () => {
  it("returns false when no failures", () => {
    expect(shouldHalt({ total: 10, failed: 0 })).toBe(false);
  });

  it("returns false when failure rate is below 20%", () => {
    expect(shouldHalt({ total: 10, failed: 1 })).toBe(false);
  });

  it("returns true when failure rate exceeds 20%", () => {
    expect(shouldHalt({ total: 10, failed: 3 })).toBe(true);
  });

  it("returns false when total is 0", () => {
    expect(shouldHalt({ total: 0, failed: 0 })).toBe(false);
  });

  it("returns false at exactly 20%", () => {
    expect(shouldHalt({ total: 5, failed: 1 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/batch/circuit-breaker.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement circuit-breaker.ts**

```typescript
// lib/batch/circuit-breaker.ts

const FAILURE_RATE_THRESHOLD = 0.2;

export function shouldHalt(stats: { total: number; failed: number }): boolean {
  if (stats.total === 0) return false;
  return stats.failed / stats.total > FAILURE_RATE_THRESHOLD;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/batch/circuit-breaker.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/batch/circuit-breaker.ts lib/batch/circuit-breaker.test.ts
git commit -m "feat: add circuit breaker for batch send failure rate"
```

---

## Chunk 3: Inngest Functions + Wiring

### Task 8: Add Batch Events to Inngest

**Files:**
- Modify: `inngest/events.ts`

- [ ] **Step 1: Add batch event types**

At the end of `inngest/events.ts`, before the Events map, add:

```typescript
// --- Batch Communication Events ---
type BatchTenantReadyEvent = {
  data: {
    franqueadoraId: string;
    runDate: string; // YYYY-MM-DD
    dryRun: boolean;
  };
};

type BatchEvaluatedEvent = {
  data: {
    franqueadoraId: string;
    runDate: string;
    batchRunId: string;
    dryRun: boolean;
  };
};

type BatchGroupReadyEvent = {
  data: {
    messageGroupId: string;
    batchRunId: string;
    franqueadoraId: string;
  };
};
```

- [ ] **Step 2: Add to Events map**

In the `Events` type, add:

```typescript
"batch/tenant.ready": BatchTenantReadyEvent;
"batch/evaluated": BatchEvaluatedEvent;
"batch/group.ready": BatchGroupReadyEvent;
```

- [ ] **Step 3: Deprecate charge/overdue**

Add comment above the existing `charge/overdue` entry:

```typescript
/** @deprecated — batch evaluates by dueDate + status, not events */
"charge/overdue": ChargeOverdueEvent;
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add inngest/events.ts
git commit -m "feat: add batch communication events to Inngest schema"
```

---

### Task 9: Batch Orchestrator

**Files:**
- Create: `inngest/scheduled/batch-orchestrator.ts`

- [ ] **Step 1: Implement orchestrator**

```typescript
// inngest/scheduled/batch-orchestrator.ts
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

function todayBRT(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export const batchOrchestrator = inngest.createFunction(
  { id: "batch-orchestrator", retries: 3 },
  { cron: "0 11 * * 1-5" }, // 8h BRT (UTC-3)
  async ({ step }) => {
    const runDate = todayBRT();

    // Step 1: Transition PENDING → OVERDUE
    const transitioned = await step.run("transition-overdue", async () => {
      const result = await prisma.charge.updateMany({
        where: {
          status: "PENDING",
          dueDate: { lt: new Date(runDate) },
        },
        data: { status: "OVERDUE" },
      });
      return result.count;
    });

    // Step 2: Find active tenants
    const tenants = await step.run("load-tenants", async () => {
      const franqueadoras = await prisma.franqueadora.findMany({
        where: { dunningRules: { some: { active: true } } },
        select: { id: true },
      });
      return franqueadoras.map((f) => f.id);
    });

    // Step 3: Fan-out
    if (tenants.length > 0) {
      await step.sendEvent(
        "fan-out",
        tenants.map((franqueadoraId) => ({
          name: "batch/tenant.ready" as const,
          data: { franqueadoraId, runDate, dryRun: false },
        }))
      );
    }

    return { transitioned, tenants: tenants.length };
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add inngest/scheduled/batch-orchestrator.ts
git commit -m "feat: add batch orchestrator with status transitions and fan-out"
```

---

### Task 10: Batch Evaluate Function

**Files:**
- Create: `inngest/functions/batch-evaluate.ts`

- [ ] **Step 1: Implement**

```typescript
// inngest/functions/batch-evaluate.ts
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { findNextStep, isCommunicationChannel, isEscalationChannel, isCallChannel, getEscalationType } from "@/lib/batch/evaluate";

export const batchEvaluate = inngest.createFunction(
  {
    id: "batch-evaluate",
    retries: 3,
    concurrency: [{ key: "event.data.franqueadoraId", limit: 1 }],
  },
  { event: "batch/tenant.ready" },
  async ({ event, step }) => {
    const { franqueadoraId, runDate, dryRun } = event.data;
    const runDateObj = new Date(runDate);

    // Step 1: Upsert BatchRun
    const batchRun = await step.run("upsert-batch-run", async () => {
      const existing = await prisma.batchRun.findUnique({
        where: { franqueadoraId_runDate: { franqueadoraId, runDate: runDateObj } },
      });
      if (existing && (existing.status === "COMPLETED" || existing.status === "RUNNING")) {
        return { id: existing.id, skip: true };
      }
      const run = await prisma.batchRun.upsert({
        where: { franqueadoraId_runDate: { franqueadoraId, runDate: runDateObj } },
        create: { franqueadoraId, runDate: runDateObj, status: "RUNNING", startedAt: new Date() },
        update: { status: "RUNNING", startedAt: new Date() },
      });
      return { id: run.id, skip: false };
    });

    if (batchRun.skip) return { batchRunId: batchRun.id, skipped: true };

    // Step 2: Load rules and compute max BEFORE_DUE offset
    const rulesData = await step.run("load-rules", async () => {
      const rules = await prisma.dunningRule.findMany({
        where: { franqueadoraId, active: true },
        include: { steps: { where: { enabled: true } } },
      });

      let maxBeforeDueOffset = 0;
      for (const rule of rules) {
        for (const s of rule.steps) {
          if (s.trigger === "BEFORE_DUE" && s.offsetDays > maxBeforeDueOffset) {
            maxBeforeDueOffset = s.offsetDays;
          }
        }
      }

      return { rules, maxBeforeDueOffset };
    });

    // Step 3: Load charges
    const charges = await step.run("load-charges", async () => {
      const maxDate = new Date(runDate);
      // Add maxBeforeDueOffset calendar days (generous — business days would be fewer)
      maxDate.setDate(maxDate.getDate() + rulesData.maxBeforeDueOffset + 4); // +4 for weekend buffer

      return prisma.charge.findMany({
        where: {
          customer: { franqueadoraId },
          status: { in: ["OVERDUE", "PENDING"] },
          dueDate: { lte: maxDate },
        },
        include: {
          customer: { include: { riskScore: true } },
          communicationIntents: { select: { stepId: true } },
        },
      });
    });

    // Step 4: Evaluate each charge
    const result = await step.run("evaluate-charges", async () => {
      const rulesByProfile = new Map<string, typeof rulesData.rules[0]>();
      for (const rule of rulesData.rules) {
        rulesByProfile.set(rule.riskProfile, rule);
      }

      let intentsCreated = 0;
      let escalationsCreated = 0;
      let tasksCreated = 0;

      for (const charge of charges) {
        const profile = charge.customer.riskScore?.riskProfile ?? "BOM_PAGADOR";
        const rule = rulesByProfile.get(profile);
        if (!rule) continue;

        const firedStepIds = charge.communicationIntents.map((ci) => ci.stepId);
        const nextStep = findNextStep(rule.steps, charge.dueDate, runDateObj, firedStepIds);
        if (!nextStep) continue;

        if (isCommunicationChannel(nextStep.channel)) {
          await prisma.communicationIntent.upsert({
            where: { chargeId_stepId: { chargeId: charge.id, stepId: nextStep.id } },
            create: {
              batchRunId: batchRun.id,
              chargeId: charge.id,
              customerId: charge.customerId,
              stepId: nextStep.id,
              phase: nextStep.phase,
              channel: nextStep.channel,
              offsetDays: nextStep.offsetDays,
            },
            update: {}, // no-op on conflict
          });
          intentsCreated++;
        } else if (isEscalationChannel(nextStep.channel)) {
          const escType = getEscalationType(nextStep.channel);
          if (escType) {
            await prisma.escalationTask.create({
              data: {
                chargeId: charge.id,
                type: escType,
                description: `Batch: ${nextStep.channel} para fatura ${charge.id}`,
              },
            });
            escalationsCreated++;
          }
        } else if (isCallChannel(nextStep.channel)) {
          const systemUser = await prisma.user.findFirst({
            where: { role: "ADMINISTRADOR" },
            select: { id: true },
          });
          if (systemUser) {
            await prisma.collectionTask.create({
              data: {
                customerId: charge.customerId,
                chargeId: charge.id,
                title: `Ligar para devedor: ${charge.customer.name}`,
                description: `Fase ${nextStep.phase}, fatura de ${charge.amountCents / 100}`,
                priority: "MEDIA",
                createdById: systemUser.id,
              },
            });
            tasksCreated++;
          }
        }
      }

      return { intentsCreated, escalationsCreated, tasksCreated };
    });

    // Step 5: Emit next event
    if (!dryRun) {
      await step.sendEvent("trigger-group", {
        name: "batch/evaluated" as const,
        data: { franqueadoraId, runDate, batchRunId: batchRun.id, dryRun },
      });
    }

    return { batchRunId: batchRun.id, ...result };
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add inngest/functions/batch-evaluate.ts
git commit -m "feat: add batch-evaluate Inngest function"
```

---

### Task 11: Batch Group Function

**Files:**
- Create: `inngest/functions/batch-group.ts`

- [ ] **Step 1: Implement**

```typescript
// inngest/functions/batch-group.ts
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { groupIntentsByRecipient, resolveRecipient, maxPhase, PHASE_SEVERITY } from "@/lib/batch/group";
import { renderConsolidatedMessage } from "@/lib/batch/render";

export const batchGroup = inngest.createFunction(
  { id: "batch-group", retries: 3 },
  { event: "batch/evaluated" },
  async ({ event, step }) => {
    const { batchRunId, franqueadoraId, runDate, dryRun } = event.data;

    // Step 1: Load and group intents
    const groupResult = await step.run("group-intents", async () => {
      const intents = await prisma.communicationIntent.findMany({
        where: { batchRunId, status: "PENDING" },
        include: {
          customer: true,
          charge: { include: { boleto: true } },
          step: { include: { variants: { where: { isWinner: true }, take: 1 } } },
        },
      });

      if (intents.length === 0) return { groupsCreated: 0, skipped: 0 };

      const groups = groupIntentsByRecipient(intents);
      let groupsCreated = 0;
      let skipped = 0;
      const groupIds: string[] = [];

      for (const group of groups) {
        const customer = group.intents[0].customer;
        const recipient = resolveRecipient(group.channel, customer);

        if (!recipient) {
          await prisma.communicationIntent.updateMany({
            where: { id: { in: group.intents.map((i) => i.id) } },
            data: { status: "SKIPPED" },
          });
          skipped += group.intents.length;
          continue;
        }

        const phases = group.intents.map((i) => i.phase);
        const dominantPhase = maxPhase(phases);

        // Pick template from the step of the most severe intent (using severity ordering)
        const primaryIntent = group.intents.reduce((max, i) =>
          PHASE_SEVERITY[i.phase] >= PHASE_SEVERITY[max.phase] ? i : max
        );
        const winnerVariant = primaryIntent.step.variants?.[0];
        const template = winnerVariant?.template ?? primaryIntent.step.template;

        const charges = group.intents.map((i) => ({
          description: i.charge.description,
          amountCents: i.charge.amountCents,
          dueDate: i.charge.dueDate,
          boleto: i.charge.boleto,
        }));

        const renderedMessage = renderConsolidatedMessage(
          group.channel,
          dominantPhase,
          customer,
          charges,
          template,
          new Date(runDate)
        );

        const mg = await prisma.messageGroup.upsert({
          where: {
            batchRunId_customerId_channel: {
              batchRunId,
              customerId: group.customerId,
              channel: group.channel,
            },
          },
          create: {
            batchRunId,
            franqueadoraId,
            customerId: group.customerId,
            channel: group.channel,
            recipient,
            phase: dominantPhase,
            renderedMessage,
            status: "READY",
          },
          update: {},
        });

        await prisma.communicationIntent.updateMany({
          where: { id: { in: group.intents.map((i) => i.id) } },
          data: { status: "GROUPED", messageGroupId: mg.id },
        });

        groupIds.push(mg.id);
        groupsCreated++;
      }

      return { groupsCreated, skipped, groupIds };
    });

    // Step 2: Fan-out sends
    if (!dryRun && groupResult.groupIds && groupResult.groupIds.length > 0) {
      await step.sendEvent(
        "fan-out-sends",
        groupResult.groupIds.map((messageGroupId) => ({
          name: "batch/group.ready" as const,
          data: { messageGroupId, batchRunId, franqueadoraId },
        }))
      );
    }

    return groupResult;
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add inngest/functions/batch-group.ts
git commit -m "feat: add batch-group Inngest function with consolidated rendering"
```

---

### Task 12: Batch Send Function

**Files:**
- Create: `inngest/functions/batch-send.ts`

- [ ] **Step 1: Implement**

```typescript
// inngest/functions/batch-send.ts
import { inngest } from "../client";
import { NonRetriableError } from "inngest";
import { prisma } from "@/lib/prisma";
import { dispatchMessage } from "@/lib/agent/dispatch";
import { shouldHalt } from "@/lib/batch/circuit-breaker";
import { renderConsolidatedMessage } from "@/lib/batch/render";
import { maxPhase, PHASE_SEVERITY } from "@/lib/batch/group";

export const batchSend = inngest.createFunction(
  {
    id: "batch-send",
    retries: 3,
    concurrency: [{ limit: 10 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const mgId = event.data.event.data.messageGroupId;
      const mg = await p.messageGroup.findUnique({
        where: { id: mgId },
        select: { customerId: true, channel: true },
      });
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (systemUser && mg) {
        await p.collectionTask.create({
          data: {
            title: `[FALHA BATCH] Envio falhou após retries`,
            description: `MessageGroup ${mgId}, canal ${mg.channel}, erro: ${error.message}`,
            priority: "CRITICA",
            status: "PENDENTE",
            customerId: mg.customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  { event: "batch/group.ready" },
  async ({ event, step }) => {
    const { messageGroupId, batchRunId } = event.data;

    const result = await step.run("send", async () => {
      // 1. Load group (include step for re-render)
      const group = await prisma.messageGroup.findUnique({
        where: { id: messageGroupId },
        include: {
          intents: {
            include: {
              charge: { include: { boleto: true } },
              step: { include: { variants: { where: { isWinner: true }, take: 1 } } },
            },
          },
          customer: true,
          batchRun: { select: { runDate: true } },
        },
      });

      if (!group || group.status !== "READY") {
        return { status: "skipped", reason: "not-ready" };
      }

      // 2. Circuit breaker (NonRetriableError avoids wasted retries)
      const stats = await prisma.messageGroup.groupBy({
        by: ["status"],
        where: { batchRunId },
        _count: true,
      });
      const total = stats.reduce((sum, s) => sum + s._count, 0);
      const failed = stats.find((s) => s.status === "FAILED")?._count ?? 0;

      if (shouldHalt({ total, failed })) {
        await prisma.batchRun.update({
          where: { id: batchRunId },
          data: { status: "FAILED" },
        });
        throw new NonRetriableError("Circuit breaker: failure rate exceeded 20%");
      }

      // 3. Freshness check
      const activeIntents = [];
      for (const intent of group.intents) {
        const fresh = await prisma.charge.findUnique({
          where: { id: intent.chargeId },
          select: { status: true },
        });
        if (fresh && fresh.status !== "PAID" && fresh.status !== "CANCELED") {
          activeIntents.push(intent);
        } else {
          await prisma.communicationIntent.update({
            where: { id: intent.id },
            data: { status: "SKIPPED" },
          });
        }
      }

      if (activeIntents.length === 0) {
        await prisma.messageGroup.update({
          where: { id: messageGroupId },
          data: { status: "SKIPPED" },
        });
        return { status: "skipped", reason: "all-paid" };
      }

      // Re-render if some charges were removed (use step template, not rendered message)
      let message = group.renderedMessage!;
      if (activeIntents.length !== group.intents.length) {
        const charges = activeIntents.map((i) => ({
          description: i.charge.description,
          amountCents: i.charge.amountCents,
          dueDate: i.charge.dueDate,
          boleto: i.charge.boleto,
        }));
        const phases = activeIntents.map((i) => i.phase);
        // Pick template from the most severe intent's step
        const primaryIntent = activeIntents.reduce((max, i) =>
          PHASE_SEVERITY[i.phase] >= PHASE_SEVERITY[max.phase] ? i : max
        );
        const winnerVariant = primaryIntent.step.variants?.[0];
        const template = winnerVariant?.template ?? primaryIntent.step.template;
        message = renderConsolidatedMessage(
          group.channel,
          maxPhase(phases),
          group.customer,
          charges,
          template,
          group.batchRun.runDate
        );
      }

      // 4. Create conversation + message
      let conversation = await prisma.conversation.findFirst({
        where: { customerId: group.customerId, channel: group.channel, status: { not: "RESOLVIDA" } },
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            customerId: group.customerId,
            channel: group.channel,
            status: "ABERTA",
            franqueadoraId: group.franqueadoraId,
          },
        });
      }

      const msg = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender: "SYSTEM",
          content: message,
          contentType: "text",
          channel: group.channel,
        },
      });

      // 5. Dispatch
      const dispatchResult = await dispatchMessage({
        channel: group.channel,
        content: message,
        customerId: group.customerId,
        conversationId: conversation.id,
        messageId: msg.id,
        franqueadoraId: group.franqueadoraId,
      });

      if (!dispatchResult.success) {
        throw new Error(`Dispatch failed: ${dispatchResult.error}`);
      }

      // 6. Mark success
      await prisma.messageGroup.update({
        where: { id: messageGroupId },
        data: { status: "SENT", sentAt: new Date() },
      });

      await prisma.communicationIntent.updateMany({
        where: { id: { in: activeIntents.map((i) => i.id) } },
        data: { status: "SENT" },
      });

      // 7. Create engagement event (NOT message/sent to avoid double-dispatch)
      if (group.customer.franqueadoraId) {
        await prisma.engagementEvent.create({
          data: {
            customerId: group.customerId,
            messageId: msg.id,
            channel: group.channel,
            eventType: "SENT",
            occurredAt: new Date(),
            franqueadoraId: group.customer.franqueadoraId!,
          },
        });
      }

      return { status: "sent", providerMsgId: dispatchResult.providerMsgId };
    });

    return result;
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add inngest/functions/batch-send.ts
git commit -m "feat: add batch-send with freshness check, circuit breaker, dead letter"
```

---

### Task 13: Cancel Intents on Payment

**Files:**
- Create: `inngest/functions/cancel-intents-on-payment.ts`

- [ ] **Step 1: Implement**

```typescript
// inngest/functions/cancel-intents-on-payment.ts
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const cancelIntentsOnPayment = inngest.createFunction(
  { id: "cancel-intents-on-payment", retries: 3 },
  { event: "charge/paid" },
  async ({ event, step }) => {
    const { chargeId } = event.data;

    return await step.run("cancel-intents", async () => {
      // 1. Find pending intents for this charge
      const intents = await prisma.communicationIntent.findMany({
        where: { chargeId, status: { in: ["PENDING", "GROUPED"] } },
        select: { id: true, messageGroupId: true },
      });

      if (intents.length === 0) return { cancelled: 0 };

      // 2. Mark as SKIPPED
      await prisma.communicationIntent.updateMany({
        where: { id: { in: intents.map((i) => i.id) } },
        data: { status: "SKIPPED" },
      });

      // 3. Check if any MessageGroups are now fully skipped
      const groupIds = [...new Set(intents.map((i) => i.messageGroupId).filter(Boolean))] as string[];
      let groupsSkipped = 0;

      for (const groupId of groupIds) {
        const remaining = await prisma.communicationIntent.count({
          where: { messageGroupId: groupId, status: { notIn: ["SKIPPED"] } },
        });
        if (remaining === 0) {
          await prisma.messageGroup.update({
            where: { id: groupId },
            data: { status: "SKIPPED" },
          });
          groupsSkipped++;
        }
      }

      return { cancelled: intents.length, groupsSkipped };
    });
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add inngest/functions/cancel-intents-on-payment.ts
git commit -m "feat: add cancel-intents-on-payment handler"
```

---

### Task 14: Batch Finalizer

**Files:**
- Create: `inngest/scheduled/batch-finalizer.ts`

- [ ] **Step 1: Implement**

```typescript
// inngest/scheduled/batch-finalizer.ts
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

function todayBRT(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export const batchFinalizer = inngest.createFunction(
  { id: "batch-finalizer", retries: 3 },
  { cron: "0 13 * * 1-5" }, // 10h BRT
  async ({ step }) => {
    const runDate = todayBRT();

    // Step 1: Complete batches where all groups are done
    const completed = await step.run("complete-batches", async () => {
      const runningBatches = await prisma.batchRun.findMany({
        where: { runDate: new Date(runDate), status: "RUNNING" },
      });

      let completedCount = 0;
      for (const batch of runningBatches) {
        const pendingGroups = await prisma.messageGroup.count({
          where: { batchRunId: batch.id, status: { in: ["PENDING", "READY"] } },
        });
        if (pendingGroups === 0) {
          // Compile stats via query
          const intents = await prisma.communicationIntent.groupBy({
            by: ["status"],
            where: { batchRunId: batch.id },
            _count: true,
          });
          const groups = await prisma.messageGroup.groupBy({
            by: ["status"],
            where: { batchRunId: batch.id },
            _count: true,
          });

          const stats = {
            intentsCreated: intents.reduce((sum, i) => sum + i._count, 0),
            groupsCreated: groups.reduce((sum, g) => sum + g._count, 0),
            sent: intents.find((i) => i.status === "SENT")?._count ?? 0,
            failed: intents.find((i) => i.status === "FAILED")?._count ?? 0,
            skipped: intents.find((i) => i.status === "SKIPPED")?._count ?? 0,
          };

          await prisma.batchRun.update({
            where: { id: batch.id },
            data: { status: "COMPLETED", completedAt: new Date(), stats },
          });
          completedCount++;
        }
      }
      return completedCount;
    });

    // Step 2: Alert on SLA violations
    const slaCheck = await step.run("sla-check", async () => {
      const stuck = await prisma.batchRun.findMany({
        where: { runDate: new Date(runDate), status: { in: ["PENDING", "RUNNING"] } },
        select: { franqueadoraId: true },
      });

      if (stuck.length > 0) {
        const systemUser = await prisma.user.findFirst({
          where: { role: "ADMINISTRADOR" },
          select: { id: true },
        });
        const anyCustomer = await prisma.customer.findFirst({ select: { id: true } });

        if (systemUser && anyCustomer) {
          await prisma.collectionTask.create({
            data: {
              title: "[SLA] Batch não completou em 2h",
              description: `Franqueadoras: ${stuck.map((s) => s.franqueadoraId).join(", ")}`,
              priority: "CRITICA",
              status: "PENDENTE",
              customerId: anyCustomer.id,
              createdById: systemUser.id,
            },
          });
        }
      }
      return stuck.length;
    });

    return { completed, slaViolations: slaCheck };
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add inngest/scheduled/batch-finalizer.ts
git commit -m "feat: add batch finalizer with SLA checks and stats compilation"
```

---

### Task 15: Wire Up — Update inngest/index.ts and Clean Up

**Files:**
- Modify: `inngest/index.ts`
- Modify: `inngest/sagas/charge-lifecycle.ts`
- Modify: `inngest/functions/update-risk-score.ts`

- [ ] **Step 1: Update inngest/index.ts**

Replace the entire file:

```typescript
// inngest/index.ts
export { inngest } from "./client";

// Reactive functions
import { updateRiskScore } from "./functions/update-risk-score";
import { logInteraction } from "./functions/log-interaction";
import { handleEscalation } from "./functions/handle-escalation";
import { handleDeliveryStatus } from "./functions/handle-delivery-status";
import { notifyPaymentReceived } from "./functions/notify-payment-received";
import { logAgentDecision } from "./functions/log-agent-decision";
import { dispatchOnSend } from "./functions/dispatch-on-send";
import {
  captureEngagementFromDelivery,
  captureEngagementFromRead,
  captureEngagementFromReply,
  captureEngagementFromPayment,
} from "./functions/capture-engagement";
import { erpPushSync } from "./functions/erp-push-sync";
import { erpCreateInvoice } from "./functions/erp-create-invoice";

// Batch communication engine
import { batchEvaluate } from "./functions/batch-evaluate";
import { batchGroup } from "./functions/batch-group";
import { batchSend } from "./functions/batch-send";
import { cancelIntentsOnPayment } from "./functions/cancel-intents-on-payment";

// Scheduled functions
import { recalculateRiskScores } from "./scheduled/recalculate-risk-scores";
import { refreshResolverStats } from "./scheduled/refresh-resolver-stats";
import { refreshCustomerProfiles } from "./scheduled/refresh-customer-profiles";
import { evaluateVariants } from "./scheduled/evaluate-variants";
import { erpPollSync } from "./scheduled/erp-poll-sync";
import { batchOrchestrator } from "./scheduled/batch-orchestrator";
import { batchFinalizer } from "./scheduled/batch-finalizer";

// Sagas (inbox + ERP only — dunning-saga removed)
import { chargeLifecycle } from "./sagas/charge-lifecycle";
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
  captureEngagementFromDelivery,
  captureEngagementFromRead,
  captureEngagementFromReply,
  captureEngagementFromPayment,
  erpPushSync,
  erpCreateInvoice,
  cancelIntentsOnPayment,
  // Batch communication engine
  batchEvaluate,
  batchGroup,
  batchSend,
  // Scheduled
  batchOrchestrator,
  batchFinalizer,
  recalculateRiskScores,
  refreshResolverStats,
  refreshCustomerProfiles,
  evaluateVariants,
  erpPollSync,
  // Sagas
  chargeLifecycle,
  inboundProcessing,
  omieSync,
];
```

Removed: `dunningSaga`, `checkPendingCharges`.

- [ ] **Step 2: Modify charge-lifecycle.ts — remove step 4 (emit overdue)**

In `inngest/sagas/charge-lifecycle.ts`, remove lines 55-82 (the `sleepUntil`, `check-payment`, and `emit-overdue` steps). Keep only the boleto generation (steps 1-3, which is actually just step 1 "generate-boleto"). The function becomes:

```typescript
// inngest/sagas/charge-lifecycle.ts
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

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
  { event: "charge/created" },
  async ({ event, step }) => {
    const { chargeId } = event.data;

    // Generate boleto
    await step.run("generate-boleto", async () => {
      const charge = await prisma.charge.findUnique({
        where: { id: chargeId },
        include: { boleto: true },
      });

      if (charge && !charge.boleto) {
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

    // OVERDUE transition and dunning are now handled by batch-orchestrator
    return { chargeId, result: "boleto-generated" };
  }
);
```

- [ ] **Step 3: Modify update-risk-score.ts — remove charge/overdue trigger**

Change the triggers from:
```typescript
[
  { event: "charge/paid" },
  { event: "charge/overdue" },
  { event: "charge/partially-paid" },
],
```
To:
```typescript
[
  { event: "charge/paid" },
  { event: "charge/partially-paid" },
],
```

- [ ] **Step 4: Delete dunning-saga.ts and check-pending-charges.ts**

Run:
```bash
rm inngest/sagas/dunning-saga.ts
rm inngest/scheduled/check-pending-charges.ts
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add inngest/ lib/batch/
git add -u  # stages deletions
git commit -m "feat: wire up batch engine, remove dunning-saga and check-pending-charges"
```

---

### Task 16: Verify End-to-End (Manual)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: No errors on startup

- [ ] **Step 2: Verify Inngest dashboard**

Open Inngest dev server. Verify all new functions appear:
- `batch-orchestrator` (cron)
- `batch-finalizer` (cron)
- `batch-evaluate` (event)
- `batch-group` (event)
- `batch-send` (event)
- `cancel-intents-on-payment` (event)

Verify removed functions do NOT appear:
- `dunning-saga`
- `check-pending-charges`

- [ ] **Step 3: Trigger dry-run test**

Via Inngest dashboard, send event:
```json
{
  "name": "batch/tenant.ready",
  "data": {
    "franqueadoraId": "<id from seed>",
    "runDate": "2026-03-13",
    "dryRun": true
  }
}
```

Expected: Evaluate creates intents, Group creates groups with rendered messages, no sends triggered.

- [ ] **Step 4: Inspect results in database**

```sql
SELECT * FROM "CommunicationIntent" ORDER BY "createdAt" DESC LIMIT 10;
SELECT * FROM "MessageGroup" ORDER BY "createdAt" DESC LIMIT 10;
```

Verify intents and groups were created with correct data.
