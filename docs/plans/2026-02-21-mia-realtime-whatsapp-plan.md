# Mia Real-Time WhatsApp + Melhorias — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Mia respond to WhatsApp messages in real-time (2-5s) with enriched context, adaptive tone, and new actions (send boleto, negotiate, mark promise, schedule callback).

**Architecture:** Queue with immediate dispatch. Orchestrator processes inbound → calls Claude → enqueues with priority IMMEDIATE → dispatches inline. Failed sends fall back to cron retry. New action handlers in `lib/agent/actions/`.

**Tech Stack:** Next.js 14, Prisma/PostgreSQL (Supabase), Anthropic Claude SDK, Twilio WhatsApp, TypeScript.

---

## Task 1: Schema — Add negotiation fields to AgentConfig + new AgentActions

**Files:**
- Modify: `prisma/schema.prisma:295-303` (AgentAction enum)
- Modify: `prisma/schema.prisma:498-514` (AgentConfig model)

**Step 1: Add new enum values to AgentAction**

In `prisma/schema.prisma`, update the `AgentAction` enum:

```prisma
enum AgentAction {
  SEND_COLLECTION
  RESPOND_CUSTOMER
  ESCALATE_HUMAN
  NEGOTIATE
  SKIP
  MARK_PROMISE
  UPDATE_STATUS
  SEND_BOLETO
  SCHEDULE_CALLBACK
}
```

**Step 2: Add negotiation fields to AgentConfig**

In `prisma/schema.prisma`, add fields to `AgentConfig`:

```prisma
model AgentConfig {
  id                   String       @id @default(cuid())
  franqueadoraId       String       @unique
  franqueadora         Franqueadora @relation(fields: [franqueadoraId], references: [id])
  enabled              Boolean      @default(true)
  maxDailyMessages     Int          @default(100)
  escalationThreshold  Float        @default(0.3)
  highValueThreshold   Int          @default(1000000)
  workingHoursStart    Int          @default(8)
  workingHoursEnd      Int          @default(20)
  timezone             String       @default("America/Sao_Paulo")
  systemPromptOverride String?      @db.Text
  whatsappFrom         String?      @unique
  smsFrom              String?      @unique
  maxInstallments        Int     @default(6)
  monthlyInterestRate    Float   @default(0.02)
  maxCashDiscount        Float   @default(0.10)
  minInstallmentCents    Int     @default(5000)
  maxFirstInstallmentDays Int    @default(30)
  negotiationRules       Json?
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt
}
```

**Step 3: Run migration**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx prisma migrate dev --name add-negotiation-fields`

Expected: Migration created and applied successfully.

**Step 4: Verify Prisma client generated**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx prisma generate`

Expected: `Prisma Client generated successfully`

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add negotiation fields to AgentConfig + SEND_BOLETO/SCHEDULE_CALLBACK actions"
```

---

## Task 2: Types — Update AIDecision and InboundContext

**Files:**
- Modify: `lib/agent/types.ts`

**Step 1: Add metadata to AIDecision and enrichment fields to InboundContext**

Replace the full content of `lib/agent/types.ts`:

```typescript
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
  score: number; // 0-100, higher = riskier
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
  // Enriched fields
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
```

**Step 2: Commit**

```bash
git add lib/agent/types.ts
git commit -m "feat: add enriched types for InboundContext, AIDecision metadata, negotiation config"
```

---

## Task 3: Context Builder — Enrich with payment history, boleto, risk score, negotiation rules

**Files:**
- Modify: `lib/agent/context-builder.ts:101-172` (buildInboundContext function)
- Modify: `lib/agent/context-builder.ts:227-277` (renderInboundPrompt function)

**Step 1: Update buildInboundContext to fetch enriched data**

Replace the `buildInboundContext` function in `lib/agent/context-builder.ts`:

```typescript
export async function buildInboundContext(
  conversationId: string,
  inboundMessage: string
): Promise<InboundContext | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!conversation || !conversation.customer.franqueadoraId) return null;

  const customerId = conversation.customerId;
  const franqueadoraId = conversation.customer.franqueadoraId;

  // Fetch all enrichment data in parallel
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [
    openCharges,
    recentDecisions,
    openTasks,
    paidCharges,
    allCharges,
    promiseDecisions,
    boletosRaw,
    agentConfig,
  ] = await Promise.all([
    prisma.charge.findMany({
      where: { customerId, status: { in: ["PENDING", "OVERDUE"] } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.agentDecisionLog.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.collectionTask.findMany({
      where: { customerId, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
      take: 5,
    }),
    // Payment history: paid charges in last 6 months
    prisma.charge.findMany({
      where: { customerId, status: "PAID", paidAt: { gte: sixMonthsAgo } },
      select: { dueDate: true, paidAt: true },
    }),
    // All charges in last 6 months for default rate
    prisma.charge.count({
      where: { customerId, createdAt: { gte: sixMonthsAgo } },
    }),
    // Promise decisions
    prisma.agentDecisionLog.findMany({
      where: { customerId, action: "MARK_PROMISE" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // Boletos for open charges
    prisma.boleto.findMany({
      where: {
        charge: { customerId, status: { in: ["PENDING", "OVERDUE"] } },
      },
      select: {
        chargeId: true,
        linhaDigitavel: true,
        publicUrl: true,
      },
    }),
    // Agent config for negotiation rules
    prisma.agentConfig.findUnique({
      where: { franqueadoraId },
    }),
  ]);

  // Calculate payment history
  const overdueCharges = await prisma.charge.count({
    where: { customerId, status: "OVERDUE" },
  });

  let totalDaysLate = 0;
  let lateCount = 0;
  for (const c of paidCharges) {
    if (c.paidAt && c.paidAt > c.dueDate) {
      const daysLate = Math.round(
        (c.paidAt.getTime() - c.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalDaysLate += daysLate;
      lateCount++;
    }
  }

  const paymentHistory: import("./types").PaymentHistory = {
    totalPaid: paidCharges.length,
    totalCharges: allCharges,
    averageDaysLate: lateCount > 0 ? Math.round(totalDaysLate / lateCount) : 0,
    defaultRate:
      allCharges > 0
        ? Math.round(((overdueCharges / allCharges) * 100) * 100) / 100
        : 0,
  };

  // Calculate promise history
  // A promise is "kept" if the charge was paid after the promise was made
  let promisesKept = 0;
  let promisesBroken = 0;
  for (const p of promiseDecisions) {
    if (p.chargeId) {
      const charge = await prisma.charge.findUnique({
        where: { id: p.chargeId },
        select: { status: true },
      });
      if (charge?.status === "PAID") {
        promisesKept++;
      } else {
        promisesBroken++;
      }
    }
  }

  const promiseHistory: import("./types").PromiseHistory = {
    total: promiseDecisions.length,
    kept: promisesKept,
    broken: promisesBroken,
  };

  // Calculate risk score (0-100)
  let riskPoints = 0;
  riskPoints += Math.min(paymentHistory.averageDaysLate * 2, 30); // up to 30 pts
  riskPoints += Math.min(paymentHistory.defaultRate, 30); // up to 30 pts
  riskPoints += promiseHistory.broken * 10; // 10 pts per broken promise, up to 20
  riskPoints += overdueCharges * 5; // 5 pts per overdue, up to 20
  riskPoints = Math.min(riskPoints, 100);

  const riskLabel =
    riskPoints <= 25
      ? "BAIXO"
      : riskPoints <= 50
        ? "MEDIO"
        : riskPoints <= 75
          ? "ALTO"
          : "CRITICO";

  const riskScore: import("./types").RiskScore = {
    score: riskPoints,
    label: riskLabel,
  };

  // Build negotiation config
  const tiers = Array.isArray(agentConfig?.negotiationRules)
    ? (agentConfig.negotiationRules as import("./types").NegotiationRuleTier[])
    : [];

  const negotiationConfig: import("./types").NegotiationConfig = {
    maxInstallments: agentConfig?.maxInstallments ?? 6,
    monthlyInterestRate: agentConfig?.monthlyInterestRate ?? 0.02,
    maxCashDiscount: agentConfig?.maxCashDiscount ?? 0.10,
    minInstallmentCents: agentConfig?.minInstallmentCents ?? 5000,
    maxFirstInstallmentDays: agentConfig?.maxFirstInstallmentDays ?? 30,
    tiers,
  };

  return {
    customer: {
      id: conversation.customer.id,
      name: conversation.customer.name,
      email: conversation.customer.email,
      phone: conversation.customer.phone,
    },
    conversationId,
    channel: conversation.channel,
    inboundMessage,
    recentMessages: conversation.messages.map((m) => ({
      sender: m.sender,
      content: m.content,
      createdAt: m.createdAt,
    })),
    recentDecisions: recentDecisions.map((d) => ({
      action: d.action,
      reasoning: d.reasoning,
      createdAt: d.createdAt,
    })),
    openCharges: openCharges.map((c) => ({
      id: c.id,
      description: c.description,
      amountCents: c.amountCents,
      dueDate: c.dueDate,
      status: c.status,
    })),
    openTasks: openTasks.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
    })),
    franqueadoraId,
    boletos: boletosRaw.map((b) => ({
      chargeId: b.chargeId,
      linhaDigitavel: b.linhaDigitavel,
      publicUrl: b.publicUrl,
    })),
    paymentHistory,
    promiseHistory,
    riskScore,
    negotiationConfig,
  };
}
```

**Step 2: Update renderInboundPrompt to include enriched data**

Replace the `renderInboundPrompt` function:

```typescript
export function renderInboundPrompt(ctx: InboundContext): string {
  const messagesText =
    ctx.recentMessages.length > 0
      ? ctx.recentMessages
          .map(
            (m) =>
              `[${formatDate(m.createdAt)}] ${m.sender}: ${m.content.slice(0, 200)}`
          )
          .join("\n")
      : "Nenhuma mensagem anterior.";

  const decisionsText =
    ctx.recentDecisions.length > 0
      ? ctx.recentDecisions
          .map(
            (d) =>
              `[${formatDate(d.createdAt)}] ${d.action}: ${d.reasoning.slice(0, 150)}`
          )
          .join("\n")
      : "Nenhuma decisao anterior.";

  const chargesText =
    ctx.openCharges.length > 0
      ? ctx.openCharges
          .map(
            (c) =>
              `- [${c.id}] ${c.description}: ${formatCurrency(c.amountCents)} (venc. ${formatDate(c.dueDate)}, ${c.status})`
          )
          .join("\n")
      : "Nenhuma cobranca em aberto.";

  const tasksText =
    ctx.openTasks.length > 0
      ? ctx.openTasks
          .map((t) => `- ${t.title} (${t.status}, ${t.priority})`)
          .join("\n")
      : "Nenhuma tarefa aberta.";

  const boletosText =
    ctx.boletos.length > 0
      ? ctx.boletos
          .map(
            (b) =>
              `- Cobranca ${b.chargeId}: Link: ${b.publicUrl} | Linha digitavel: ${b.linhaDigitavel}`
          )
          .join("\n")
      : "Nenhum boleto disponivel.";

  const ph = ctx.paymentHistory;
  const paymentHistoryText = `Pagamentos (6 meses): ${ph.totalPaid}/${ph.totalCharges} pagos | Atraso medio: ${ph.averageDaysLate} dias | Taxa inadimplencia: ${ph.defaultRate}%`;

  const pm = ctx.promiseHistory;
  const promiseText = `Promessas: ${pm.total} total | ${pm.kept} cumpridas | ${pm.broken} quebradas`;

  const rs = ctx.riskScore;
  const riskText = `Score de Risco: ${rs.score}/100 (${rs.label})`;

  const nc = ctx.negotiationConfig;
  let negotiationText = `Regras de Negociacao:\n- Max parcelas: ${nc.maxInstallments}\n- Juros mensal: ${(nc.monthlyInterestRate * 100).toFixed(1)}%\n- Desconto max a vista: ${(nc.maxCashDiscount * 100).toFixed(0)}%\n- Parcela minima: ${formatCurrency(nc.minInstallmentCents)}\n- Prazo max 1a parcela: ${nc.maxFirstInstallmentDays} dias`;

  if (nc.tiers.length > 0) {
    negotiationText += "\n- Faixas de valor:";
    for (const tier of nc.tiers) {
      const max = tier.maxCents ? formatCurrency(tier.maxCents) : "sem limite";
      negotiationText += `\n  ${formatCurrency(tier.minCents)} a ${max}: ate ${tier.maxInstallments}x, juros ${(tier.interestRate * 100).toFixed(1)}%`;
    }
  }

  return INBOUND_CONTEXT_TEMPLATE
    .replace("{{customerName}}", ctx.customer.name)
    .replace("{{customerEmail}}", ctx.customer.email)
    .replace("{{customerPhone}}", ctx.customer.phone)
    .replace("{{inboundMessage}}", ctx.inboundMessage)
    .replace("{{channel}}", ctx.channel)
    .replace("{{openCharges}}", chargesText)
    .replace("{{recentMessages}}", messagesText)
    .replace("{{recentDecisions}}", decisionsText)
    .replace("{{openTasks}}", tasksText)
    .replace("{{boletos}}", boletosText)
    .replace("{{paymentHistory}}", paymentHistoryText)
    .replace("{{promiseHistory}}", promiseText)
    .replace("{{riskScore}}", riskText)
    .replace("{{negotiationRules}}", negotiationText);
}
```

**Step 3: Commit**

```bash
git add lib/agent/context-builder.ts
git commit -m "feat: enrich inbound context with payment history, boletos, risk score, negotiation rules"
```

---

## Task 4: Prompts — Improved system prompt + updated context template

**Files:**
- Modify: `lib/agent/prompts.ts`

**Step 1: Update MIA_SYSTEM_PROMPT with adaptive tone and new actions**

Replace `MIA_SYSTEM_PROMPT` in `lib/agent/prompts.ts`:

```typescript
export const MIA_SYSTEM_PROMPT = `Voce e Mia, a agente de cobranca automatizada da Menlo. Seu objetivo e recuperar valores devidos de forma profissional e respeitosa, mantendo o bom relacionamento com o cliente.

## Persona
- Nome: Mia
- Papel: Agente de cobranca inteligente
- Tom: Profissional, empatico, respeitoso
- Idioma: Portugues brasileiro (pt-BR)

## Regras Fundamentais
1. NUNCA ameace o cliente de forma alguma
2. NUNCA invente dados — use apenas as informacoes fornecidas no contexto
3. Respeite horario comercial (8h-20h)
4. Ofereca facilidades quando o cliente demonstrar dificuldade financeira
5. Adapte o tom ao canal:
   - **WhatsApp**: informal, direto, mensagens curtas (max 300 caracteres)
   - **SMS**: ultra-curto (max 160 caracteres), essencial apenas
   - **Email**: formal, completo, pode ser mais longo (max 500 palavras)

## Tom Adaptativo (baseado no Score de Risco)
- **BAIXO (0-25)**: Tom amigavel e leve. Cliente bom pagador, lembrete gentil.
- **MEDIO (26-50)**: Tom cordial mas direto. Enfatize a importancia do pagamento.
- **ALTO (51-75)**: Tom firme mas educado. Seja claro sobre consequencias do atraso.
- **CRITICO (76-100)**: Tom urgente e serio. Destaque a gravidade sem agressividade.

## Escalacao Obrigatoria (SEMPRE escalar quando):
- Cliente mencionar advogado, processo, justica, Procon, Reclame Aqui ou orgao de defesa
- Cliente pedir explicitamente para falar com um humano/atendente/gerente/supervisor
- Cliente demonstrar angustia emocional grave
- Disputar a existencia ou valor da divida
- Voce nao tiver certeza de como responder (confianca < 30%)
- Negociacao solicitada fora dos limites configurados

## Acoes Disponiveis

### RESPOND_CUSTOMER
Resposta generica ao cliente. Use quando a mensagem nao requer acao especifica.

### SEND_BOLETO
Quando o cliente pedir boleto, 2a via, link de pagamento ou linha digitavel.
- Use os dados de boleto do contexto (publicUrl e linhaDigitavel)
- Se nao houver boleto disponivel, informe que esta verificando e alguem entrara em contato

### NEGOTIATE
Quando o cliente pedir parcelamento, desconto ou negociacao.
- SEMPRE respeite as regras de negociacao do contexto
- Use as faixas de valor quando disponíveis para determinar max parcelas e juros
- Calcule o valor das parcelas e apresente ao cliente
- Se o pedido estiver FORA das regras, NAO negocie — escale para humano

### MARK_PROMISE
Quando o cliente prometer pagar em uma data especifica.
- Registre a data da promessa no campo metadata.promiseDate (formato YYYY-MM-DD)
- Inclua o chargeId no metadata se identificavel
- Confirme a data ao cliente

### SCHEDULE_CALLBACK
Quando o cliente pedir para alguem ligar de volta ou agendar contato.
- Registre a data/hora no metadata.callbackDate (formato ISO 8601)
- Ajuste para horario comercial se necessario
- Confirme o agendamento ao cliente

### ESCALATE_HUMAN
Transferir para atendente humano. Use nos casos obrigatorios listados acima.

### SKIP
Nao responder. Use apenas quando a mensagem nao requer resposta (ex: "ok", emoji isolado apos confirmacao).

## Formato de Resposta
Responda APENAS em JSON valido com a seguinte estrutura:
{
  "action": "RESPOND_CUSTOMER" | "SEND_BOLETO" | "NEGOTIATE" | "MARK_PROMISE" | "SCHEDULE_CALLBACK" | "ESCALATE_HUMAN" | "SKIP" | "SEND_COLLECTION" | "UPDATE_STATUS",
  "message": "Mensagem para o cliente (ou vazio se SKIP/ESCALATE_HUMAN)",
  "confidence": 0.0-1.0,
  "reasoning": "Explicacao curta da decisao",
  "escalationReason": null | "LEGAL_THREAT" | "COMPLAINT_AUTHORITY" | "REPEATED_FAILURE" | "HIGH_VALUE" | "EXPLICIT_REQUEST" | "EMOTIONAL_DISTRESS" | "DISPUTE" | "AI_UNCERTAINTY",
  "metadata": {
    "promiseDate": null,
    "installments": null,
    "callbackDate": null,
    "chargeId": null
  }
}`;
```

**Step 2: Update INBOUND_CONTEXT_TEMPLATE with new placeholders**

Replace `INBOUND_CONTEXT_TEMPLATE` in `lib/agent/prompts.ts`:

```typescript
export const INBOUND_CONTEXT_TEMPLATE = `## Contexto da Conversa

### Cliente
- Nome: {{customerName}}
- Email: {{customerEmail}}
- Telefone: {{customerPhone}}

### Perfil do Cliente
{{paymentHistory}}
{{promiseHistory}}
{{riskScore}}

### Mensagem Recebida
"{{inboundMessage}}"

### Canal
{{channel}}

### Cobrancas em Aberto
{{openCharges}}

### Boletos Disponiveis
{{boletos}}

### Historico Recente de Mensagens (ultimas 20)
{{recentMessages}}

### Decisoes AI Anteriores (ultimas 5)
{{recentDecisions}}

### Tarefas Abertas
{{openTasks}}

### {{negotiationRules}}

## Sua Tarefa
Analise a mensagem do cliente e decida a melhor resposta. Adapte o tom ao score de risco do cliente. Se o cliente pedir boleto, use SEND_BOLETO. Se pedir parcelamento/desconto, use NEGOTIATE (respeitando as regras). Se prometer pagar, use MARK_PROMISE. Se pedir contato humano ou callback, use SCHEDULE_CALLBACK ou ESCALATE_HUMAN conforme o caso.`;
```

**Step 3: Commit**

```bash
git add lib/agent/prompts.ts
git commit -m "feat: enhanced Mia prompt with adaptive tone, new actions, negotiation instructions"
```

---

## Task 5: AI Module — Parse new actions and metadata

**Files:**
- Modify: `lib/agent/ai.ts:17-45` (parseAIResponse function)

**Step 1: Update parseAIResponse to handle metadata**

Replace the `parseAIResponse` function in `lib/agent/ai.ts`:

```typescript
function parseAIResponse(text: string): AIDecision {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      action: "SKIP",
      message: "",
      confidence: 0,
      reasoning: "Falha ao parsear resposta da IA",
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const metadata: AIDecisionMetadata = {};

    if (parsed.metadata) {
      if (parsed.metadata.promiseDate) metadata.promiseDate = parsed.metadata.promiseDate;
      if (typeof parsed.metadata.installments === "number") metadata.installments = parsed.metadata.installments;
      if (parsed.metadata.callbackDate) metadata.callbackDate = parsed.metadata.callbackDate;
      if (parsed.metadata.chargeId) metadata.chargeId = parsed.metadata.chargeId;
    }

    return {
      action: parsed.action || "SKIP",
      message: parsed.message || "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      reasoning: parsed.reasoning || "",
      escalationReason: parsed.escalationReason || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  } catch {
    return {
      action: "SKIP",
      message: "",
      confidence: 0,
      reasoning: "Erro de parse JSON na resposta da IA",
    };
  }
}
```

**Step 2: Update import to include AIDecisionMetadata**

At the top of `lib/agent/ai.ts`, update the import:

```typescript
import type { AIDecision, AIDecisionMetadata, CollectionContext, InboundContext } from "./types";
```

**Step 3: Commit**

```bash
git add lib/agent/ai.ts
git commit -m "feat: parse new AI actions and metadata in AI response"
```

---

## Task 6: Action Handlers — send-boleto, negotiate, mark-promise, schedule-callback

**Files:**
- Create: `lib/agent/actions/send-boleto.ts`
- Create: `lib/agent/actions/negotiate.ts`
- Create: `lib/agent/actions/mark-promise.ts`
- Create: `lib/agent/actions/schedule-callback.ts`

**Step 1: Create send-boleto action**

Create file `lib/agent/actions/send-boleto.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import type { InboundContext, AIDecision } from "../types";

export interface SendBoletoResult {
  message: string;
  createHumanTask: boolean;
}

export async function executeSendBoleto(
  ctx: InboundContext,
  decision: AIDecision
): Promise<SendBoletoResult> {
  // Try to find the boleto from decision metadata or first available
  const targetChargeId = decision.metadata?.chargeId;

  const boleto = targetChargeId
    ? ctx.boletos.find((b) => b.chargeId === targetChargeId)
    : ctx.boletos[0];

  if (!boleto) {
    // No boleto available — create task for human
    return {
      message:
        "Estou verificando o seu boleto. Em instantes, um especialista da nossa equipe vai enviar para voce.",
      createHumanTask: true,
    };
  }

  // Build message with boleto info
  const message =
    ctx.channel === "WHATSAPP" || ctx.channel === "SMS"
      ? `Aqui esta o link do seu boleto: ${boleto.publicUrl}`
      : `Segue o link para pagamento do seu boleto:\n\n${boleto.publicUrl}\n\nLinha digitavel: ${boleto.linhaDigitavel}`;

  return {
    message,
    createHumanTask: false,
  };
}
```

**Step 2: Create negotiate action**

Create file `lib/agent/actions/negotiate.ts`:

```typescript
import type { InboundContext, AIDecision, NegotiationConfig, NegotiationRuleTier } from "../types";
import { formatCurrency } from "@/lib/utils";

export interface NegotiateResult {
  approved: boolean;
  message: string;
  escalateReason?: string;
}

function findTier(
  amountCents: number,
  tiers: NegotiationRuleTier[]
): NegotiationRuleTier | null {
  for (const tier of tiers) {
    const aboveMin = amountCents >= tier.minCents;
    const belowMax = tier.maxCents === null || amountCents <= tier.maxCents;
    if (aboveMin && belowMax) return tier;
  }
  return null;
}

export function validateNegotiation(
  requestedInstallments: number,
  amountCents: number,
  config: NegotiationConfig
): NegotiateResult {
  // Find applicable tier
  const tier =
    config.tiers.length > 0
      ? findTier(amountCents, config.tiers)
      : null;

  const maxInstallments = tier?.maxInstallments ?? config.maxInstallments;
  const interestRate = tier?.interestRate ?? config.monthlyInterestRate;

  // Validate installments
  if (requestedInstallments > maxInstallments) {
    return {
      approved: false,
      message: "",
      escalateReason: `Cliente pediu ${requestedInstallments}x, maximo permitido e ${maxInstallments}x para esta faixa de valor`,
    };
  }

  // Calculate installment value
  let installmentCents: number;
  if (interestRate > 0 && requestedInstallments > 1) {
    // PMT formula with interest
    const rate = interestRate;
    const n = requestedInstallments;
    const factor = (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
    installmentCents = Math.ceil(amountCents * factor);
  } else {
    installmentCents = Math.ceil(amountCents / requestedInstallments);
  }

  // Check minimum installment
  if (installmentCents < config.minInstallmentCents) {
    return {
      approved: false,
      message: "",
      escalateReason: `Parcela de ${formatCurrency(installmentCents)} abaixo do minimo de ${formatCurrency(config.minInstallmentCents)}`,
    };
  }

  const totalWithInterest = installmentCents * requestedInstallments;

  // Build approval message
  let message: string;
  if (requestedInstallments === 1) {
    message = `Podemos fazer em 1x de ${formatCurrency(amountCents)}.`;
  } else if (interestRate > 0) {
    message = `Podemos parcelar em ${requestedInstallments}x de ${formatCurrency(installmentCents)} (total: ${formatCurrency(totalWithInterest)}, juros de ${(interestRate * 100).toFixed(1)}% a.m.).`;
  } else {
    message = `Podemos parcelar em ${requestedInstallments}x de ${formatCurrency(installmentCents)} sem juros.`;
  }

  return { approved: true, message };
}
```

**Step 3: Create mark-promise action**

Create file `lib/agent/actions/mark-promise.ts`:

```typescript
import { prisma } from "@/lib/prisma";

export async function executeMarkPromise(
  customerId: string,
  franqueadoraId: string,
  promiseDate: string,
  chargeId?: string | null
): Promise<void> {
  // Find a system user for task creation
  const systemUser = await prisma.user.findFirst({
    where: { franqueadoraId, role: "ADMINISTRADOR" },
  });

  if (!systemUser) return;

  // Create follow-up task for the day after the promise
  const followUpDate = new Date(promiseDate);
  followUpDate.setDate(followUpDate.getDate() + 1);

  await prisma.collectionTask.create({
    data: {
      customerId,
      chargeId: chargeId || undefined,
      title: `[PROMESSA] Verificar pagamento prometido para ${promiseDate}`,
      description: `Cliente prometeu pagar em ${promiseDate}. Verificar se pagamento foi realizado.`,
      status: "PENDENTE",
      priority: "ALTA",
      dueDate: followUpDate,
      createdById: systemUser.id,
    },
  });
}
```

**Step 4: Create schedule-callback action**

Create file `lib/agent/actions/schedule-callback.ts`:

```typescript
import { prisma } from "@/lib/prisma";

export async function executeScheduleCallback(
  customerId: string,
  franqueadoraId: string,
  callbackDate: string
): Promise<string> {
  const systemUser = await prisma.user.findFirst({
    where: { franqueadoraId, role: "ADMINISTRADOR" },
  });

  if (!systemUser) {
    return "Nao foi possivel agendar o callback — entre em contato novamente.";
  }

  let scheduledDate = new Date(callbackDate);

  // If outside working hours, move to next business day at 9am
  const hour = scheduledDate.getHours();
  if (hour < 8) {
    scheduledDate.setHours(9, 0, 0, 0);
  } else if (hour >= 20) {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
    scheduledDate.setHours(9, 0, 0, 0);
  }

  // Skip weekends
  const day = scheduledDate.getDay();
  if (day === 0) scheduledDate.setDate(scheduledDate.getDate() + 1); // Sun -> Mon
  if (day === 6) scheduledDate.setDate(scheduledDate.getDate() + 2); // Sat -> Mon

  await prisma.collectionTask.create({
    data: {
      customerId,
      title: `[CALLBACK] Cliente solicitou retorno`,
      description: `Cliente pediu que um atendente ligue de volta.\nAgendado para: ${scheduledDate.toISOString()}`,
      status: "PENDENTE",
      priority: "ALTA",
      dueDate: scheduledDate,
      createdById: systemUser.id,
    },
  });

  // Format for display
  const formatted = scheduledDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return formatted;
}
```

**Step 5: Commit**

```bash
git add lib/agent/actions/
git commit -m "feat: add action handlers for send-boleto, negotiate, mark-promise, schedule-callback"
```

---

## Task 7: Dispatch — Add dispatchImmediate function

**Files:**
- Modify: `lib/agent/dispatch.ts`

**Step 1: Add dispatchImmediate function**

Add to the end of `lib/agent/dispatch.ts` (before the closing of the file):

```typescript
/**
 * Immediately dispatch a just-enqueued message without waiting for cron.
 * Called inline by the orchestrator after enqueueing an IMMEDIATE-priority message.
 * If dispatch fails, the item stays in the queue for cron retry.
 */
export async function dispatchImmediate(queueItemId: string): Promise<DispatchResult> {
  const item = await prisma.messageQueue.findUnique({
    where: { id: queueItemId },
  });

  if (!item || item.status !== "PENDING") {
    return { success: false, error: "Queue item not found or not pending" };
  }

  return dispatchMessage(item);
}
```

**Step 2: Commit**

```bash
git add lib/agent/dispatch.ts
git commit -m "feat: add dispatchImmediate for real-time message sending"
```

---

## Task 8: Orchestrator — Wire new actions + immediate dispatch

**Files:**
- Modify: `lib/agent/orchestrator.ts:205-342` (processInboundMessage function)

**Step 1: Add imports at the top of orchestrator.ts**

Add these imports to the top of `lib/agent/orchestrator.ts`:

```typescript
import { dispatchImmediate } from "./dispatch";
import { executeSendBoleto } from "./actions/send-boleto";
import { validateNegotiation } from "./actions/negotiate";
import { executeMarkPromise } from "./actions/mark-promise";
import { executeScheduleCallback } from "./actions/schedule-callback";
```

**Step 2: Replace processInboundMessage function**

Replace the entire `processInboundMessage` function in `lib/agent/orchestrator.ts`:

```typescript
export async function processInboundMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: {
        include: { customer: true },
      },
    },
  });

  if (!message || !message.conversation.customer.franqueadoraId) return;

  const franqueadoraId = message.conversation.customer.franqueadoraId;
  const customerId = message.conversation.customerId;

  const config = await prisma.agentConfig.findUnique({
    where: { franqueadoraId },
  });

  if (!config?.enabled) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "PENDENTE_HUMANO" },
    });
    return;
  }

  // Update conversation status
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "PENDENTE_IA" },
  });

  // Build enriched context
  const ctx = await buildInboundContext(conversationId, message.content);
  if (!ctx) return;

  // Get AI decision
  const decision = await decideInboundResponse(ctx, config.systemPromptOverride);

  // Safety net: force escalation check
  const forceCheck = shouldForceEscalate(
    decision,
    message.content,
    {
      escalationThreshold: config.escalationThreshold,
      highValueThreshold: config.highValueThreshold,
    }
  );

  const failureCheck = await checkConsecutiveFailures(customerId);

  const shouldEscalate = forceCheck.shouldEscalate || failureCheck.shouldEscalate;
  const finalAction = shouldEscalate ? "ESCALATE_HUMAN" : decision.action;
  const finalReasoning = forceCheck.shouldEscalate
    ? `Safety net: ${forceCheck.details}`
    : failureCheck.shouldEscalate
      ? `Safety net: ${failureCheck.details}`
      : decision.reasoning;
  const finalEscalationReason = forceCheck.shouldEscalate
    ? forceCheck.reason
    : failureCheck.shouldEscalate
      ? failureCheck.reason
      : decision.escalationReason;

  // Log the decision
  await prisma.agentDecisionLog.create({
    data: {
      conversationId,
      customerId,
      franqueadoraId,
      action: finalAction,
      reasoning: finalReasoning,
      confidence: decision.confidence,
      inputContext: JSON.stringify({
        conversationId,
        messageId,
        inboundMessage: message.content.slice(0, 500),
      }),
      outputMessage: decision.message,
      escalationReason: finalEscalationReason,
      executedAt: new Date(),
    },
  });

  // Execute escalation if needed
  if (shouldEscalate) {
    const reason = forceCheck.reason || failureCheck.reason || "AI_UNCERTAINTY";
    const details =
      forceCheck.details || failureCheck.details || "Safety net triggered";
    await executeEscalation(conversationId, customerId, reason, details, franqueadoraId);
    return;
  }

  if (finalAction === "ESCALATE_HUMAN" && decision.escalationReason) {
    await executeEscalation(
      conversationId, customerId, decision.escalationReason, decision.reasoning, franqueadoraId
    );
    return;
  }

  // Handle specific actions
  let messageContent = decision.message;

  if (finalAction === "SEND_BOLETO") {
    const boletoResult = await executeSendBoleto(ctx, decision);
    messageContent = boletoResult.message;

    if (boletoResult.createHumanTask) {
      const systemUser = await prisma.user.findFirst({
        where: { franqueadoraId, role: "ADMINISTRADOR" },
      });
      if (systemUser) {
        await prisma.collectionTask.create({
          data: {
            customerId,
            title: "[BOLETO] Cliente solicitou boleto nao disponivel",
            description: `Cliente pediu boleto mas nenhum esta disponivel no sistema.\nConversation: ${conversationId}`,
            status: "PENDENTE",
            priority: "ALTA",
            createdById: systemUser.id,
          },
        });
      }
    }
  }

  if (finalAction === "NEGOTIATE" && decision.metadata?.installments) {
    // Find the most relevant charge
    const targetChargeId = decision.metadata.chargeId;
    const charge = targetChargeId
      ? ctx.openCharges.find((c) => c.id === targetChargeId)
      : ctx.openCharges[0];

    if (charge) {
      const result = validateNegotiation(
        decision.metadata.installments,
        charge.amountCents,
        ctx.negotiationConfig
      );

      if (result.approved) {
        messageContent = result.message;
      } else {
        // Outside negotiation rules — escalate
        await executeEscalation(
          conversationId,
          customerId,
          "AI_UNCERTAINTY",
          result.escalateReason || "Negociacao fora dos limites configurados",
          franqueadoraId
        );
        return;
      }
    }
  }

  if (finalAction === "MARK_PROMISE" && decision.metadata?.promiseDate) {
    await executeMarkPromise(
      customerId,
      franqueadoraId,
      decision.metadata.promiseDate,
      decision.metadata.chargeId
    );
  }

  if (finalAction === "SCHEDULE_CALLBACK") {
    const callbackDate =
      decision.metadata?.callbackDate || new Date(Date.now() + 3600000).toISOString();
    const formatted = await executeScheduleCallback(customerId, franqueadoraId, callbackDate);
    messageContent =
      decision.message ||
      `Agendei um retorno de um especialista para ${formatted}. Obrigada!`;
  }

  // Enqueue and immediately dispatch
  if (messageContent) {
    const queueItem = await prisma.messageQueue.create({
      data: {
        customerId,
        conversationId,
        channel: message.conversation.channel,
        content: messageContent,
        status: "PENDING",
        priority: 10, // IMMEDIATE priority (higher than normal 0-3)
        scheduledFor: new Date(),
        franqueadoraId,
      },
    });

    // Dispatch immediately — don't wait for cron
    try {
      await dispatchImmediate(queueItem.id);
    } catch (err) {
      console.error("[Orchestrator] Immediate dispatch failed, will retry via cron:", err);
      // Item stays PENDING in queue for cron retry
    }
  }

  // Update conversation status
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "ABERTA" },
  });
}
```

**Step 3: Commit**

```bash
git add lib/agent/orchestrator.ts
git commit -m "feat: wire new actions + immediate dispatch in orchestrator for real-time WhatsApp responses"
```

---

## Task 9: Verify — Manual end-to-end test

**Step 1: Generate Prisma client**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx prisma generate`

Expected: `Prisma Client generated successfully`

**Step 2: Check TypeScript compilation**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx tsc --noEmit`

Expected: No errors. If there are type errors, fix them.

**Step 3: Start dev server**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npm run dev`

Expected: Server starts without errors.

**Step 4: Test the flow manually**

Send a WhatsApp message to the registered Twilio number. Expected flow:
1. Webhook receives the message (check Vercel logs)
2. `process-inbound` is called (fire-and-forget)
3. Orchestrator builds enriched context
4. Claude returns decision with action
5. Message is enqueued with priority 10 (IMMEDIATE)
6. `dispatchImmediate` sends via Twilio
7. Customer receives response within 2-5 seconds

**Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: Mia real-time WhatsApp integration complete"
```
