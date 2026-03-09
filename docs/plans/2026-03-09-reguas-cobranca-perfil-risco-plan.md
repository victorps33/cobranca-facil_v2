# Réguas de Cobrança por Perfil de Risco — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Segmentar réguas de cobrança por perfil de risco (Bom Pagador, Duvidoso, Mau Pagador), com fases visuais, escalonamento (negativação/protesto/jurídico) e cálculo automático de risco.

**Architecture:** Uma régua por perfil de risco, com fases fixas pré-definidas e steps customizáveis dentro de cada fase. Escalonamento semi-automático via EscalationTasks. Mock de integrações externas (Boa Vista, Cartório). Score de risco calculado automaticamente por cron.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma 5, PostgreSQL (Supabase), Tailwind CSS, shadcn/ui, Radix UI, Lucide React.

**Design doc:** `docs/plans/2026-03-09-reguas-cobranca-perfil-risco-design.md`

---

## Task 1: Schema — Novos enums e modelos Prisma

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Adicionar novos enums ao schema**

No final da seção de enums (após `enum NotificationStatus`, por volta da linha 120), adicionar:

```prisma
enum RiskProfile {
  BOM_PAGADOR
  DUVIDOSO
  MAU_PAGADOR
}

enum DunningPhase {
  LEMBRETE
  VENCIMENTO
  ATRASO
  NEGATIVACAO
  COBRANCA_INTENSIVA
  PROTESTO
  POS_PROTESTO
}

enum EscalationType {
  NEGATIVACAO
  PROTESTO
  JURIDICO
}

enum EscalationStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

**Step 2: Expandir enum Channel**

Encontrar o enum `Channel` existente e adicionar novos valores:

```prisma
enum Channel {
  EMAIL
  SMS
  WHATSAPP
  LIGACAO
  BOA_VISTA
  CARTORIO
  JURIDICO
}
```

**Step 3: Adicionar campos ao model DunningRule**

Encontrar o model `DunningRule` e adicionar os novos campos (com defaults para não quebrar dados existentes):

```prisma
model DunningRule {
  id             String        @id @default(cuid())
  name           String
  active         Boolean       @default(true)
  timezone       String        @default("America/Sao_Paulo")
  riskProfile    RiskProfile   @default(BOM_PAGADOR)
  maxPhase       DunningPhase  @default(ATRASO)
  franqueadoraId String?
  franqueadora   Franqueadora? @relation(fields: [franqueadoraId], references: [id])
  createdAt      DateTime      @default(now())
  steps          DunningStep[]
}
```

**Step 4: Adicionar campo phase ao model DunningStep**

Encontrar o model `DunningStep` e adicionar:

```prisma
model DunningStep {
  id               String            @id @default(cuid())
  ruleId           String
  rule             DunningRule       @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  trigger          DunningTrigger
  offsetDays       Int               @default(0)
  channel          Channel
  template         String
  enabled          Boolean           @default(true)
  phase            DunningPhase      @default(LEMBRETE)
  createdAt        DateTime          @default(now())
  notificationLogs NotificationLog[]
}
```

**Step 5: Adicionar model FranchiseeRiskScore**

Após o model `Customer`, adicionar:

```prisma
model FranchiseeRiskScore {
  id               String      @id @default(cuid())
  customerId       String      @unique
  customer         Customer    @relation(fields: [customerId], references: [id])
  defaultRate      Float
  avgDaysLate      Float
  totalOutstanding Int
  riskProfile      RiskProfile
  calculatedAt     DateTime    @default(now())
  updatedAt        DateTime    @updatedAt
}
```

Adicionar a relação reversa no model `Customer`:

```prisma
riskScore FranchiseeRiskScore?
```

**Step 6: Adicionar model EscalationTask**

Após o model `FranchiseeRiskScore`, adicionar:

```prisma
model EscalationTask {
  id          String           @id @default(cuid())
  chargeId    String
  charge      Charge           @relation(fields: [chargeId], references: [id])
  type        EscalationType
  status      EscalationStatus @default(PENDING)
  description String
  resolvedAt  DateTime?
  resolvedBy  String?
  createdAt   DateTime         @default(now())
}
```

Adicionar a relação reversa no model `Charge`:

```prisma
escalationTasks EscalationTask[]
```

**Step 7: Gerar e aplicar migration**

Run:
```bash
cd /Users/victorsundfeld/cobranca-facil_v2
npx prisma migrate dev --name add-risk-profiles-and-escalation
```

Expected: Migration criada e aplicada com sucesso. Campos com defaults não devem causar problemas com dados existentes.

**Step 8: Gerar Prisma Client**

Run:
```bash
npx prisma generate
```

Expected: Prisma Client gerado sem erros.

**Step 9: Commit**

```bash
git add prisma/
git commit -m "feat: add risk profile, dunning phases, and escalation models to schema"
```

---

## Task 2: Lógica de cálculo do score de risco

**Files:**
- Create: `lib/risk-score.ts`

**Step 1: Criar o módulo de cálculo de risco**

```typescript
import prisma from "@/lib/prisma";
import { RiskProfile } from "@prisma/client";

interface RiskMetrics {
  defaultRate: number;
  avgDaysLate: number;
  totalOutstanding: number;
}

export function classifyRisk(metrics: RiskMetrics): RiskProfile {
  const { defaultRate, avgDaysLate, totalOutstanding } = metrics;

  // Pior métrica define o perfil
  if (
    defaultRate > 0.3 ||
    avgDaysLate > 15 ||
    totalOutstanding > 2000000 // R$20.000 em centavos
  ) {
    return "MAU_PAGADOR";
  }

  if (
    defaultRate > 0.1 ||
    avgDaysLate > 5 ||
    totalOutstanding > 500000 // R$5.000 em centavos
  ) {
    return "DUVIDOSO";
  }

  return "BOM_PAGADOR";
}

export async function calculateRiskForCustomer(customerId: string): Promise<RiskMetrics & { riskProfile: RiskProfile }> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const charges = await prisma.charge.findMany({
    where: {
      customerId,
      createdAt: { gte: twelveMonthsAgo },
      status: { not: "CANCELED" },
    },
  });

  if (charges.length === 0) {
    return {
      defaultRate: 0,
      avgDaysLate: 0,
      totalOutstanding: 0,
      riskProfile: "BOM_PAGADOR",
    };
  }

  // Taxa de inadimplência: cobranças com atraso > 5 dias ou não pagas
  const lateCharges = charges.filter((c) => {
    if (c.status === "OVERDUE") return true;
    if (c.paidAt && c.dueDate) {
      const diffDays = Math.floor(
        (c.paidAt.getTime() - c.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays > 5;
    }
    return false;
  });
  const defaultRate = lateCharges.length / charges.length;

  // Média de dias de atraso (para cobranças pagas com atraso)
  const paidLateCharges = charges.filter(
    (c) => c.paidAt && c.dueDate && c.paidAt > c.dueDate
  );
  const avgDaysLate =
    paidLateCharges.length > 0
      ? paidLateCharges.reduce((sum, c) => {
          const diff = Math.floor(
            (c.paidAt!.getTime() - c.dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + Math.max(0, diff);
        }, 0) / paidLateCharges.length
      : 0;

  // Total em aberto
  const totalOutstanding = charges
    .filter((c) => c.status === "OVERDUE" || (c.status === "PENDING" && c.dueDate < new Date()))
    .reduce((sum, c) => sum + c.amountCents, 0);

  const riskProfile = classifyRisk({ defaultRate, avgDaysLate, totalOutstanding });

  return { defaultRate, avgDaysLate, totalOutstanding, riskProfile };
}

export async function recalculateAllRiskScores(franqueadoraIds: string[]) {
  const customers = await prisma.customer.findMany({
    where: { franqueadoraId: { in: franqueadoraIds } },
    select: { id: true },
  });

  const results = [];

  for (const customer of customers) {
    const metrics = await calculateRiskForCustomer(customer.id);

    await prisma.franchiseeRiskScore.upsert({
      where: { customerId: customer.id },
      create: {
        customerId: customer.id,
        ...metrics,
      },
      update: {
        ...metrics,
        calculatedAt: new Date(),
      },
    });

    results.push({ customerId: customer.id, ...metrics });
  }

  return results;
}
```

**Step 2: Verificar que compila**

Run:
```bash
cd /Users/victorsundfeld/cobranca-facil_v2
npx tsc --noEmit lib/risk-score.ts 2>&1 | head -20
```

Se houver erros de tipo, ajustar conforme os tipos reais do Prisma schema (ex: campo `dueDate` pode ter nome diferente no schema).

**Step 3: Commit**

```bash
git add lib/risk-score.ts
git commit -m "feat: add risk score calculation logic"
```

---

## Task 3: Atualizar default dunning rules com perfis e fases

**Files:**
- Modify: `lib/default-dunning-rule.ts`

**Step 1: Reescrever com réguas por perfil**

Substituir o conteúdo inteiro de `lib/default-dunning-rule.ts` por:

```typescript
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

// ── Steps base compartilhados ──

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
```

**Step 2: Verificar compilação**

Run:
```bash
cd /Users/victorsundfeld/cobranca-facil_v2
npx tsc --noEmit lib/default-dunning-rule.ts 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add lib/default-dunning-rule.ts
git commit -m "feat: update default dunning rules with risk profiles and phases"
```

---

## Task 4: APIs — Risk scores e Escalation tasks

**Files:**
- Create: `app/api/risk-scores/route.ts`
- Create: `app/api/risk-scores/recalculate/route.ts`
- Create: `app/api/escalation-tasks/route.ts`
- Create: `app/api/escalation-tasks/[id]/route.ts`

**Step 1: API de risk scores — GET**

Create `app/api/risk-scores/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";

export async function GET() {
  const ids = await requireTenantOrGroup();

  const scores = await prisma.franchiseeRiskScore.findMany({
    where: {
      customer: { franqueadoraId: { in: ids } },
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { calculatedAt: "desc" },
  });

  return NextResponse.json(scores);
}
```

**Step 2: API de recálculo de risk scores — POST**

Create `app/api/risk-scores/recalculate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireTenantOrGroup, requireRole } from "@/lib/auth-helpers";
import { recalculateAllRiskScores } from "@/lib/risk-score";

export async function POST() {
  await requireRole(["ADMINISTRADOR"]);
  const ids = await requireTenantOrGroup();

  const results = await recalculateAllRiskScores(ids);

  return NextResponse.json({
    recalculated: results.length,
    results,
  });
}
```

**Step 3: API de escalation tasks — GET**

Create `app/api/escalation-tasks/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const ids = await requireTenantOrGroup();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {
    charge: {
      customer: { franqueadoraId: { in: ids } },
    },
  };

  if (status) where.status = status;
  if (type) where.type = type;

  const tasks = await prisma.escalationTask.findMany({
    where,
    include: {
      charge: {
        include: {
          customer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tasks);
}
```

**Step 4: API de escalation task individual — PATCH**

Create `app/api/escalation-tasks/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, requireTenantOrGroup } from "@/lib/auth-helpers";
import { getAuthSession } from "@/lib/auth-helpers";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  const ids = await requireTenantOrGroup();
  const session = await getAuthSession();
  const body = await req.json();

  const task = await prisma.escalationTask.findUnique({
    where: { id: params.id },
    include: { charge: { include: { customer: true } } },
  });

  if (!task || !ids.includes(task.charge.customer.franqueadoraId || "")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.status === "COMPLETED") {
    data.status = "COMPLETED";
    data.resolvedAt = new Date();
    data.resolvedBy = session?.user?.id || null;
  } else if (body.status === "CANCELLED") {
    data.status = "CANCELLED";
    data.resolvedAt = new Date();
    data.resolvedBy = session?.user?.id || null;
  } else if (body.status === "IN_PROGRESS") {
    data.status = "IN_PROGRESS";
  }

  const updated = await prisma.escalationTask.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(updated);
}
```

**Step 5: Commit**

```bash
git add app/api/risk-scores/ app/api/escalation-tasks/
git commit -m "feat: add risk scores and escalation tasks API endpoints"
```

---

## Task 5: Atualizar APIs existentes de dunning rules/steps

**Files:**
- Modify: `app/api/dunning-rules/route.ts`
- Modify: `app/api/dunning-rules/[id]/route.ts`
- Modify: `app/api/dunning-steps/route.ts`
- Modify: `app/api/dunning-steps/[id]/route.ts`

**Step 1: Atualizar GET de dunning rules para incluir riskProfile**

Em `app/api/dunning-rules/route.ts`, o `findMany` já inclui steps. Adicionar filtro opcional por `riskProfile`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const ids = await requireTenantOrGroup();
  const { searchParams } = new URL(req.url);
  const riskProfile = searchParams.get("riskProfile");

  const where: Record<string, unknown> = {
    franqueadoraId: { in: ids },
  };

  if (riskProfile) where.riskProfile = riskProfile;

  const rules = await prisma.dunningRule.findMany({
    where,
    include: {
      steps: { orderBy: [{ trigger: "asc" }, { offsetDays: "asc" }] },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rules);
}
```

**Step 2: Atualizar PATCH de dunning rule para aceitar novos campos**

Em `app/api/dunning-rules/[id]/route.ts`, no handler PATCH, adicionar `riskProfile` e `maxPhase` aos campos atualizáveis. Localizar o `prisma.dunningRule.update` e expandir o `data`:

```typescript
// No PATCH handler, atualizar para aceitar:
const { active, name, riskProfile, maxPhase } = body;
const data: Record<string, unknown> = {};
if (active !== undefined) data.active = active;
if (name !== undefined) data.name = name;
if (riskProfile !== undefined) data.riskProfile = riskProfile;
if (maxPhase !== undefined) data.maxPhase = maxPhase;
```

**Step 3: Atualizar POST de dunning steps para aceitar phase**

Em `app/api/dunning-steps/route.ts`, no handler POST, adicionar `phase` ao create:

```typescript
// Adicionar phase ao destructuring do body e ao prisma.dunningStep.create
const { ruleId, trigger, offsetDays, channel, template, phase } = body;
// No create:
const step = await prisma.dunningStep.create({
  data: { ruleId, trigger, offsetDays, channel, template, phase: phase || "LEMBRETE" },
});
```

**Step 4: Atualizar PATCH de dunning step para aceitar phase**

Em `app/api/dunning-steps/[id]/route.ts`, adicionar `phase` aos campos atualizáveis:

```typescript
if (body.phase !== undefined) data.phase = body.phase;
```

**Step 5: Commit**

```bash
git add app/api/dunning-rules/ app/api/dunning-steps/
git commit -m "feat: update dunning APIs to support risk profiles and phases"
```

---

## Task 6: UI — Página principal de réguas com abas por perfil

**Files:**
- Modify: `app/(dashboard)/reguas/page.tsx` (reescrita significativa)

**Step 1: Reescrever a página de réguas**

Reescrever `app/(dashboard)/reguas/page.tsx` com:
- 3 abas (Bom Pagador, Duvidoso, Mau Pagador) usando Tabs do Radix/shadcn
- Timeline visual por fases com as cores definidas no design
- Nodes com ícones por canal (incluindo novos: Ligação, Boa Vista, Cartório, Jurídico)
- Fases desabilitadas (além do maxPhase) com opacidade reduzida
- Badge de contagem de franqueados por perfil (via `/api/risk-scores`)
- Hover em nodes de escalonamento mostra "Gera tarefa de aprovação"

Referência de cores das fases:
```typescript
const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  LEMBRETE:            { bg: "bg-gray-100",    text: "text-gray-700",   border: "border-gray-300" },
  VENCIMENTO:          { bg: "bg-red-100",     text: "text-red-700",    border: "border-red-400" },
  ATRASO:              { bg: "bg-orange-100",   text: "text-orange-700", border: "border-orange-400" },
  NEGATIVACAO:         { bg: "bg-blue-900",     text: "text-white",      border: "border-blue-900" },
  COBRANCA_INTENSIVA:  { bg: "bg-blue-100",     text: "text-blue-700",   border: "border-blue-400" },
  PROTESTO:            { bg: "bg-gray-900",     text: "text-white",      border: "border-gray-900" },
  POS_PROTESTO:        { bg: "bg-gray-600",     text: "text-white",      border: "border-gray-600" },
};
```

Referência de labels e ícones dos canais:
```typescript
const CHANNEL_META: Record<string, { label: string; icon: string }> = {
  EMAIL:     { label: "Email",     icon: "Mail" },
  SMS:       { label: "SMS",       icon: "MessageSquare" },
  WHATSAPP:  { label: "WhatsApp",  icon: "MessageCircle" },
  LIGACAO:   { label: "Ligação",   icon: "Phone" },
  BOA_VISTA: { label: "Boa Vista", icon: "ShieldAlert" },
  CARTORIO:  { label: "Cartório",  icon: "FileText" },
  JURIDICO:  { label: "Jurídico",  icon: "Scale" },
};
```

Ordem das fases para comparação (usado no maxPhase):
```typescript
const PHASE_ORDER = [
  "LEMBRETE", "VENCIMENTO", "ATRASO", "NEGATIVACAO",
  "COBRANCA_INTENSIVA", "PROTESTO", "POS_PROTESTO"
] as const;
```

A timeline deve renderizar os steps agrupados por fase, com separadores visuais entre fases (labels de fase no topo, como na imagem de referência). Nodes de canais de escalonamento (BOA_VISTA, CARTORIO, JURIDICO) devem ser maiores e com visual diferenciado.

**Step 2: Verificar no browser**

Run:
```bash
cd /Users/victorsundfeld/cobranca-facil_v2
npm run dev
```

Abrir `http://localhost:3000/reguas` e verificar:
- 3 abas renderizam
- Timeline com fases visíveis
- Fases desabilitadas com opacidade
- Nodes com ícones corretos

**Step 3: Commit**

```bash
git add app/\(dashboard\)/reguas/page.tsx
git commit -m "feat: redesign réguas page with risk profile tabs and phase timeline"
```

---

## Task 7: UI — Página de edição da régua com fases

**Files:**
- Modify: `app/(dashboard)/reguas/[id]/page.tsx` (reescrita significativa)

**Step 1: Reescrever a página de edição**

Reescrever `app/(dashboard)/reguas/[id]/page.tsx` com:
- Topo: nome da régua, perfil de risco (badge), seletor de maxPhase
- Layout: fases listadas como accordion/collapsible sections
- Cada fase mostra seus steps em cards
- Steps editáveis inline (canal, dia, template)
- Botão "+ Adicionar step" dentro de cada fase
- Toggle enable/disable por step
- Canais de escalonamento (BOA_VISTA, CARTORIO, JURIDICO) mostram aviso visual
- Template textarea desabilitado para canais de escalonamento
- Formulário de step com presets de template

Componentes shadcn/ui a usar:
- `Collapsible` (do Radix) para fases accordion
- `Select` para canal e fase
- `Switch` para toggles
- `Dialog` para confirmações
- `Badge` para perfil de risco
- `Textarea` para templates

**Step 2: Verificar no browser**

Abrir `http://localhost:3000/reguas/[id]` e verificar:
- Fases em accordion funcionam
- Adicionar/editar/remover steps funciona
- maxPhase atualiza fases visíveis
- Canais de escalonamento mostram aviso

**Step 3: Commit**

```bash
git add app/\(dashboard\)/reguas/\[id\]/page.tsx
git commit -m "feat: redesign régua editor with phase accordion and escalation actions"
```

---

## Task 8: UI — Painel de escalonamento

**Files:**
- Create: `app/(dashboard)/cobrancas/escalonamento/page.tsx`

**Step 1: Criar página de escalonamento**

Criar `app/(dashboard)/cobrancas/escalonamento/page.tsx`:
- Lista de EscalationTasks com cards
- Filtros: tipo (Negativação, Protesto, Jurídico), status (Pendente, Em andamento, Concluído, Cancelado)
- Cada card mostra: nome do franqueado, valor da cobrança, dias de atraso, tipo da ação, data de criação
- Botões: "Executar" (mock — PATCH status=COMPLETED), "Cancelar" (PATCH status=CANCELLED)
- Badge colorido por tipo de ação
- Empty state quando não há tarefas

Ícones e cores por tipo:
```typescript
const ESCALATION_META = {
  NEGATIVACAO: { label: "Negativação", icon: "ShieldAlert", color: "text-blue-700 bg-blue-100" },
  PROTESTO:    { label: "Protesto",    icon: "FileText",    color: "text-gray-900 bg-gray-200" },
  JURIDICO:    { label: "Jurídico",    icon: "Scale",       color: "text-purple-700 bg-purple-100" },
};
```

**Step 2: Verificar no browser**

Abrir `http://localhost:3000/cobrancas/escalonamento` e verificar:
- Cards renderizam com mock data
- Filtros funcionam
- Botões executar/cancelar fazem PATCH

**Step 3: Commit**

```bash
git add app/\(dashboard\)/cobrancas/escalonamento/
git commit -m "feat: add escalation tasks management panel"
```

---

## Task 9: UI — Visão de risco dos franqueados

**Files:**
- Modify: `app/(dashboard)/clientes/page.tsx` (adicionar tab ou seção de risco)

**Step 1: Adicionar visualização de risco na página de clientes**

Adicionar uma seção/tab "Perfil de Risco" na página de clientes que mostra:
- Tabela com colunas: Nome, Taxa Inadimplência (%), Dias Médio Atraso, Valor em Aberto (R$), Perfil de Risco (badge)
- Badges coloridos: Bom Pagador (verde), Duvidoso (amarelo), Mau Pagador (vermelho)
- Botão "Recalcular Scores" que chama POST `/api/risk-scores/recalculate`
- Ordenação por coluna

Cores dos badges:
```typescript
const RISK_BADGE = {
  BOM_PAGADOR:  { label: "Bom Pagador",  className: "bg-green-100 text-green-800" },
  DUVIDOSO:     { label: "Duvidoso",      className: "bg-yellow-100 text-yellow-800" },
  MAU_PAGADOR:  { label: "Mau Pagador",   className: "bg-red-100 text-red-800" },
};
```

**Step 2: Verificar no browser**

Abrir `http://localhost:3000/clientes` e verificar:
- Tab/seção de risco aparece
- Dados renderizam corretamente
- Botão recalcular funciona

**Step 3: Commit**

```bash
git add app/\(dashboard\)/clientes/
git commit -m "feat: add franchisee risk profile view to clients page"
```

---

## Task 10: Sidebar — Adicionar link de escalonamento

**Files:**
- Modify: `components/sidebar.tsx`

**Step 1: Adicionar item de navegação**

No array `baseNavigation` em `components/sidebar.tsx` (por volta da linha 43), adicionar o item de escalonamento como sub-item de Cobranças ou como item independente:

```typescript
{ name: "Escalonamento", href: "/cobrancas/escalonamento", icon: AlertTriangle, roles: ["ADMINISTRADOR", "OPERACIONAL"] },
```

Importar `AlertTriangle` do `lucide-react`.

**Step 2: Verificar no browser**

Verificar que o novo link aparece no sidebar e navega corretamente.

**Step 3: Commit**

```bash
git add components/sidebar.tsx
git commit -m "feat: add escalation link to sidebar navigation"
```

---

## Task 11: Seed — Migrar réguas existentes

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Atualizar seed para criar réguas por perfil**

Atualizar `prisma/seed.ts` para usar `createDefaultDunningRules()` em vez da função anterior. Importar de `lib/default-dunning-rule.ts` e criar 3 réguas por franqueadora no seed.

Verificar se o seed existente cria apenas 1 régua e atualizar para criar as 3 réguas por perfil.

**Step 2: Testar seed (se possível em ambiente de dev)**

Run:
```bash
cd /Users/victorsundfeld/cobranca-facil_v2
npx prisma db seed
```

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: update seed to create dunning rules for all risk profiles"
```

---

## Task 12: Verificação final e ajustes

**Step 1: Verificar compilação completa**

Run:
```bash
cd /Users/victorsundfeld/cobranca-facil_v2
npx tsc --noEmit
```

Corrigir quaisquer erros de tipo.

**Step 2: Verificar build**

Run:
```bash
npm run build
```

Corrigir quaisquer erros.

**Step 3: Teste manual end-to-end**

Com `npm run dev`:
1. Abrir `/reguas` — verificar 3 abas com timelines
2. Clicar em "Editar régua" — verificar editor com fases
3. Adicionar step em uma fase — verificar que salva
4. Abrir `/clientes` — verificar seção de risco
5. Abrir `/cobrancas/escalonamento` — verificar painel

**Step 4: Commit final**

```bash
git add .
git commit -m "fix: resolve any remaining type errors and build issues"
```
