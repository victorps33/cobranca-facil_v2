# Batch Communication Engine — Design Spec

**Data:** 2026-03-13
**Status:** Draft (v3 — pós-segundo-review)
**Autor:** Victor + Claude

## Contexto

O motor de cobrança atual usa uma dunning-saga (Inngest) que executa 1 saga long-running por fatura. Quando um devedor tem N faturas vencidas, recebe N mensagens separadas. Isso gera experiência ruim, custo desnecessário com Twilio, e operação difícil de debugar.

O projeto Autopilot (menlopay/autopilot) implementa um padrão alternativo: batch diário com evaluate → group → send, consolidando mensagens por devedor. Este spec adapta essa arquitetura ao Menlo Cobrança.

## Decisões já tomadas

1. **Batch substitui a dunning-saga** — a saga será deletada, não coexistirá com o batch
2. **Régua 100% determinística** — sem IA na régua outbound. IA continua apenas no inbox (inbound-saga)
3. **Reescrita agora** — sistema não tem tráfego real, não há sagas ativas pra migrar
4. **Inngest como orquestrador** — mantém a infra existente, usa fan-out por eventos
5. **Prisma como ORM** — sem mudança de stack de acesso ao banco

## Arquitetura

### Pipeline fan-out

5 funções Inngest independentes conectadas por eventos:

```
Orchestrator (cron 8h BRT, dias úteis)
  │
  ├─ Transiciona charges PENDING → OVERDUE (assume papel do check-pending-charges)
  ├─ emite batch/tenant.ready (1 por franqueadora)
  │
  ▼
Evaluate (1 execução por franqueadora, concurrency 1 por tenant)
  │ Busca TODAS as charges ativas (inclui futuras para BEFORE_DUE)
  │ Cria CommunicationIntents / EscalationTasks / CollectionTasks
  │
  ├─ emite batch/evaluated
  │
  ▼
Group (1 execução por franqueadora)
  │ Agrupa intents por devedor+canal
  │ Renderiza mensagem consolidada
  │ Cria MessageGroups
  │
  ├─ emite batch/group.ready (1 por message group)
  │
  ▼
Send (1 execução por message group, concurrency 10 global)
  │ Freshness check → re-render se necessário → dispatch via Twilio
  │ onFailure → CollectionTask (dead letter)
  │
  ├─ emite message/sent (alimenta engagement tracking)
```

**Propriedades:**
- Franqueadoras processadas em paralelo (isolamento de falha)
- Retry por tenant, por fase, por grupo individual
- Send fan-out: 1 invocação por grupo (não N steps numa função)
- Circuit breaker: halt se failure rate > 20%
- Dry-run: flag no evento, cria intents/groups sem enviar

### Finalizer

```
Finalizer (cron 10h BRT — 2h depois do batch)
  │ Verifica batches que não completaram → alerta via CollectionTask
  │ Compila stats finais (query, não incremental — evita race condition)
```

### Cancel on Payment

```
cancel-intents-on-payment (triggered by charge/paid)
  │ Marca intents pendentes da charge como SKIPPED
  │ Se todos intents de um MessageGroup ficaram SKIPPED → group SKIPPED
```

## Modelo de dados

### Novos models

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

enum BatchStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

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

enum IntentStatus {
  PENDING
  GROUPED
  SENT
  FAILED
  SKIPPED
}

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

enum GroupStatus {
  PENDING
  READY
  SENT
  FAILED
  SKIPPED
}
```

**Nota sobre idempotência do MessageGroup:** A constraint `@@unique([batchRunId, customerId, channel])` é suficiente — `franqueadoraId` é redundante porque `batchRunId` já identifica a franqueadora via `BatchRun.@@unique([franqueadoraId, runDate])`.

### Alterações em models existentes

- `Charge` → adiciona `communicationIntents CommunicationIntent[]`
- `Customer` → adiciona `communicationIntents CommunicationIntent[]`, `messageGroups MessageGroup[]`
- `DunningStep` → adiciona `communicationIntents CommunicationIntent[]`
- `Franqueadora` → adiciona `batchRuns BatchRun[]`, `messageGroups MessageGroup[]`

### Models existentes mantidos sem mudança

- `DunningRule`, `DunningStep` — continuam como fonte de verdade da régua (DunningStep ganha apenas a relation inversa)
- `NotificationLog` — mantido pra dados históricos, novos envios vão pra `CommunicationIntent`
- Todos os models de inbox, CRM, intelligence, ERP — sem mudança

## Lógica do Pipeline

### Orchestrator

```
inngest/scheduled/batch-orchestrator.ts
Cron: "0 11 * * 1-5" (8h BRT, dias úteis)

1. Calcula runDate uma vez (timezone America/Sao_Paulo, formato YYYY-MM-DD)
   runDate é propagado por todos os eventos — nenhuma função calcula "hoje" sozinha

2. Transiciona charges PENDING → OVERDUE:
   UPDATE charges SET status = 'OVERDUE'
   WHERE status = 'PENDING' AND dueDate < runDate
   (assume o papel do check-pending-charges.ts que será deletado)

3. Busca franqueadoras com dunningRules ativas

4. Emite batch/tenant.ready para cada uma, com { franqueadoraId, runDate, dryRun: false }
```

### Evaluate

```
inngest/functions/batch-evaluate.ts
Trigger: batch/tenant.ready
Concurrency: 1 por franqueadoraId
Retries: 3

1. Upsert BatchRun (idempotente por franqueadora+runDate)
   - Se COMPLETED → return early
   - Se RUNNING → return early
   - Marca RUNNING

2. Busca DunningRules ativas da franqueadora com steps habilitados
   Agrupa por riskProfile
   Calcula maxBeforeDueOffset = max(offsetDays) dos steps BEFORE_DUE

3. Busca Charges elegíveis:
   WHERE status IN (OVERDUE, PENDING)
     AND status NOT IN (PAID, CANCELED)
     AND dueDate <= runDate + maxBeforeDueOffset dias
   Include: customer.riskScore

   Isso inclui charges com vencimento futuro (até maxBeforeDueOffset dias),
   permitindo que steps BEFORE_DUE disparem corretamente.

4. Para cada charge:
   a. riskProfile = customer.riskScore?.riskProfile ?? BOM_PAGADOR
   b. rule = rules[riskProfile] (se não tem → skip)
   c. Busca intents já existentes pra essa charge (steps já disparados)
   d. Ordena steps da rule por fireDate cronológica:
      - Computa fireDate pra cada step via computeFireDate(step.trigger, step.offsetDays, charge.dueDate)
      - Ordena por fireDate ASC
   e. Encontra o PRIMEIRO step que:
      - Não tem intent prévio
      - fireDate <= runDate
      Nota: para charges PENDING (ainda não vencidas), steps AFTER_DUE naturalmente
      não disparam porque computeFireDate(AFTER_DUE, offset, futureDate) produz uma
      fireDate no futuro, que falha no filtro fireDate <= runDate. Não é necessário
      filtrar steps por tipo de trigger — a matemática já garante o comportamento correto.
   f. Bifurca por tipo de canal:
      - EMAIL, SMS, WHATSAPP → cria CommunicationIntent (upsert, ON CONFLICT DO NOTHING)
      - LIGACAO → cria CollectionTask ("Ligar para devedor: {nome}, fatura {valor}")
      - BOA_VISTA → cria EscalationTask (type: NEGATIVACAO)
      - CARTORIO → cria EscalationTask (type: PROTESTO)
      - JURIDICO → cria EscalationTask (type: JURIDICO)

5. Emite batch/evaluated se não dryRun
```

**Só o próximo step não-enviado dispara** — preserva sequência da régua. Se o sistema ficou fora 3 dias, o devedor recebe o próximo step da fila, não todos os atrasados. Nos dias seguintes, o batch avança naturalmente pelos steps restantes.

**Steps BEFORE_DUE:** A query no passo 3 inclui charges com `dueDate` até `maxBeforeDueOffset` dias no futuro. O passo 4d calcula a `fireDate` real (ex: dueDate - 5 dias úteis) e o passo 4e filtra `fireDate <= runDate`.

### computeFireDate

```
lib/batch/fire-date.ts

Calcula a data de disparo de um step em dias úteis (seg-sex):

function computeFireDate(
  trigger: DunningTrigger,  // BEFORE_DUE | ON_DUE | AFTER_DUE
  offsetDays: number,
  dueDate: Date
): Date

Exemplos:
- BEFORE_DUE, offsetDays 5, dueDate 2026-03-20 → 2026-03-13 (5 dias úteis antes)
- ON_DUE, offsetDays 0, dueDate 2026-03-20 → 2026-03-20
- AFTER_DUE, offsetDays 7, dueDate 2026-03-20 → 2026-03-31 (7 dias úteis depois)

Adaptado do Autopilot. Conta apenas seg-sex, pula sáb/dom.
Recebe Date, retorna Date (sem hora — comparação por dia).
```

### Group

```
inngest/functions/batch-group.ts
Trigger: batch/evaluated
Retries: 3

1. Busca intents PENDING do batch
   Include: customer, step, charge

2. Agrupa por (customerId, channel)

3. Para cada grupo:
   a. Resolve recipient:
      EMAIL → customer.email
      WHATSAPP → customer.whatsappPhone ?? customer.phone
      SMS → customer.phone
      Se vazio → intents → SKIPPED, continue

   b. Determina fase mais grave (max dos intents, ordem: POS_PROTESTO > ... > LEMBRETE)

   c. Renderiza mensagem consolidada via lib/batch/render.ts
      (ver seção "Template de mensagem consolidada")

   d. Upsert MessageGroup com renderedMessage, status → READY

   e. Intents → GROUPED, vincula messageGroupId

4. Se não dryRun: fan-out — emite batch/group.ready para cada MessageGroup

Nota: NÃO chama resolvers SMART de channel/timing nesta versão.
Channel é fixo (definido no DunningStep). Timing é o horário do batch (8h).
Resolver SMART de content (variante vencedora) É suportado na renderização.
```

**Decisão sobre resolvers SMART (channel/timing):** Nesta primeira versão, `channelMode` e `timingMode` são ignorados — o batch usa o canal fixo do step e envia no horário do cron. Isso é uma simplificação consciente. O suporte a SMART channel/timing pode ser adicionado numa segunda iteração, com o batch agendando sends via `step.sleepUntil()` para horários otimizados. O resolver SMART de conteúdo (variante vencedora) funciona normalmente, pois é resolvido no render.

### Send

```
inngest/functions/batch-send.ts
Trigger: batch/group.ready
Concurrency: 10 global (rate limit Twilio)
Retries: 3
onFailure: cria CollectionTask (dead letter)

1. Carrega MessageGroup com intents → charges → customer

2. Circuit breaker:
   Conta groups FAILED vs total do batch
   Se failureRate > 20% → marca BatchRun como FAILED, throw error
   (próximos sends do mesmo batch verão FAILED e param)

3. Freshness check:
   Re-busca status das charges dos intents
   - Todas PAID/CANCELED → group SKIPPED, intents SKIPPED, return
   - Algumas pagas → remove intents dessas charges do grupo
     Se sobrou 0 intents → group SKIPPED, return
     Senão → re-renderiza mensagem com charges restantes

4. Cria/busca Conversation:
   prisma.conversation.findFirst({ customerId, channel, status: not RESOLVIDA })
   Se não existe → cria nova

5. Cria Message no conversation (sender: SYSTEM, content: renderedMessage)

6. dispatchMessage() via Twilio:
   Passa { channel, content: renderedMessage, customerId, conversationId, messageId, franqueadoraId }
   Nota: dispatchMessage() re-resolve o recipient internamente (busca customer.phone/email).
   O recipient no MessageGroup é para auditoria — o dispatch usa dados frescos do banco.

7. Se sucesso:
   - Group → SENT, sentAt = now()
   - Intents → SENT
   - Cria EngagementEvent (eventType: SENT) diretamente no banco
   - NÃO emite evento message/sent — esse evento é usado pela inbox (dispatch-on-send.ts)
     para enviar mensagens manuais/IA. Emitir aqui causaria double-dispatch.
     O tracking de delivery (DELIVERED, READ) funciona via callbacks do Twilio
     → message/delivered → captureEngagementFromDelivery (já existente).

8. Se falha:
   - throw Error → Inngest retenta (até 3x)
   - Após 3 retries → onFailure:
     Busca system admin user (prisma.user.findFirst({ role: ADMINISTRADOR }))
     Cria CollectionTask:
       title: "[FALHA BATCH] Envio para {customer.name} falhou"
       description: "MessageGroup {id}, canal {channel}, erro: {error}"
       priority: CRITICA
       customerId: group.customerId
       createdById: systemUser.id
```

### Finalizer

```
inngest/scheduled/batch-finalizer.ts
Cron: "0 13 * * 1-5" (10h BRT)

1. Para cada BatchRun RUNNING do dia:
   Conta MessageGroups por status (PENDING, READY, SENT, FAILED, SKIPPED)
   Se 0 grupos PENDING e 0 grupos READY → BatchRun.status = COMPLETED
   (todos os sends terminaram — sucesso, falha ou skip)

2. Busca BatchRuns do dia AINDA com status PENDING ou RUNNING após passo 1

3. Se encontrou → alerta (SLA de 2h violado):
   Cria CollectionTask (mesma lógica de system admin user):
     title: "[SLA] Batch não completou em 2h"
     description: "Franqueadoras afetadas: {ids}"
     priority: CRITICA

4. Compila stats finais dos batches COMPLETED (via query, não incremental):
   UPDATE batch_runs SET stats = (
     SELECT json_build_object(
       'intentsCreated', COUNT(ci.*),
       'groupsCreated', COUNT(DISTINCT mg.id),
       'sent', COUNT(ci.*) FILTER (WHERE ci.status = 'SENT'),
       'failed', COUNT(ci.*) FILTER (WHERE ci.status = 'FAILED'),
       'skipped', COUNT(ci.*) FILTER (WHERE ci.status = 'SKIPPED'),
       ...
     )
   )
   Abordagem por query evita race condition de múltiplos sends
   atualizando o mesmo BatchRun.stats concorrentemente.
```

### Cancel on Payment

```
inngest/functions/cancel-intents-on-payment.ts
Trigger: charge/paid
Retries: 3

1. Busca intents pendentes da charge:
   WHERE chargeId = X AND status IN (PENDING, GROUPED)

2. Marca como SKIPPED

3. Para cada MessageGroup afetado:
   Busca intents restantes não-SKIPPED
   Se 0 restantes → group → SKIPPED
```

## Template de mensagem consolidada

```
lib/batch/render.ts

Função principal:
  renderConsolidatedMessage(
    channel: Channel,
    phase: DunningPhase,
    customer: Customer,
    charges: ChargeWithIntent[],
    step: DunningStep
  ): string
```

### Lógica de resolução de template

1. Se `step.contentMode === SMART` e existe variante vencedora (`StepVariant.isWinner === true`):
   → usa template da variante
2. Senão: usa `step.template` fixo

### Formato por canal

**SMS (max 160 chars):**
```
{{nome}}, você tem {{qtd}} faturas em aberto totalizando {{total}}. A mais urgente vence em {{vencimento}}. Regularize: {{link}}
```

**WhatsApp (multi-charge):**
```
Oi {{nome}}, você tem faturas em aberto:

{{#charges}}
• {{descricao}} — *{{valor}}* (venc. {{vencimento}})
{{/charges}}

*Total: {{total}}*

Boleto atualizado: {{link_boleto}}

Qualquer dúvida, estamos à disposição!
```

**Email:** Mesmo padrão do WhatsApp, com HTML básico (lista de charges, total, link).

### Quando é 1 charge só

Se o grupo tem apenas 1 charge, o template existente do step funciona sem mudança (interpolação de `{{nome}}`, `{{valor}}`, `{{vencimento}}`). A renderização consolidada só ativa quando há 2+ charges.

### Variáveis disponíveis

| Variável | Fonte |
|---|---|
| `{{nome}}` | customer.name |
| `{{valor}}` | charge.amountCents (formatado R$ X.XXX,XX) |
| `{{vencimento}}` | charge.dueDate (formatado DD/MM/YYYY) |
| `{{total}}` | soma dos amountCents de todas charges |
| `{{qtd}}` | número de charges no grupo |
| `{{link_boleto}}` | charge.boleto?.publicUrl (da charge mais grave) |
| `{{dias_atraso}}` | dias entre dueDate e hoje |
| `{{descricao}}` | charge.description |

## O que é deletado

### Arquivos removidos
- `inngest/sagas/dunning-saga.ts` — substituída pelo batch
- `inngest/scheduled/check-pending-charges.ts` — papel absorvido pelo orchestrator

### Arquivo modificado
- `inngest/sagas/charge-lifecycle.ts` — **mantido**, mas removido o step 4 (emissão de `charge/overdue`). O lifecycle continua gerando boletos (steps 1-3). O evento `charge/overdue` não é mais necessário pois o batch avalia charges diretamente pela dueDate + status, não por eventos.

### Evento depreciado
- `charge/overdue` — não é mais emitido por nenhum producer. Manter a type definition em `events.ts` com comentário `// @deprecated — batch avalia por dueDate + status`. Atualizar listeners:
  - `update-risk-score`: triggers atuais são `charge/paid`, `charge/overdue`, `charge/partially-paid`. Remover `charge/overdue` dos triggers. Manter `charge/paid` e `charge/partially-paid`. O recálculo ao transicionar pra OVERDUE é coberto pelo cron diário `recalculate-risk-scores` (que já roda todo dia às 6h).
  - `handle-escalation`: triggers em `ai/escalation-triggered` (vindo da inbound-saga). **NÃO deletar** — serve o inbox/inbound, não o dunning. O batch absorve apenas a escalação da régua outbound (BOA_VISTA/CARTORIO/JURIDICO → EscalationTask no evaluate). Escalações vindas da IA no inbox continuam passando por `handle-escalation.ts`.

### Função mantida (clarificação)
- `inngest/functions/dispatch-on-send.ts` — **mantido sem mudança**. Serve a inbox (mensagens manuais e IA). O batch-send NÃO emite `message/sent`, então não há risco de double-dispatch.
- `inngest/functions/handle-escalation.ts` — **mantido sem mudança**. Serve a inbox (escalações IA).

### Código que NÃO é deletado
- `inngest/sagas/inbound-processing.ts` — inbox continua igual
- `inngest/sagas/omie-sync.ts` — ERP continua igual
- `inngest/functions/*` — handlers reativos continuam (delivery status, engagement, risk score, etc)
- `inngest/scheduled/recalculate-risk-scores.ts` — continua
- `inngest/scheduled/evaluate-variants.ts` — continua
- `inngest/scheduled/refresh-*` — continuam
- Todo o código de intelligence (resolvers, variants, engagement) — continua
- Todo o código de inbox (conversations, messages) — continua
- Todo o código de ERP (omie, conta-azul) — continua
- `lib/agent/*` — IA continua no inbox, só sai da régua

## Código reutilizado

| Código existente | Uso no batch |
|---|---|
| `lib/agent/dispatch.ts` → `dispatchMessage()` | Send: dispatch via Twilio. Aceita `DispatchRequest`, resolve recipient internamente. Sem mudança. |
| `lib/intelligence/resolvers/content.ts` | Group/Render: resolve variante vencedora quando contentMode SMART |
| `DunningRule` + `DunningStep` (models) | Evaluate: fonte de verdade da régua |
| `FranchiseeRiskScore` (model) | Evaluate: seleção de rule por perfil de risco |
| `Conversation` + `Message` (models) | Send: criação de conversation e registro de mensagem |
| `EscalationTask` (model) | Evaluate: criação de escalação pra BOA_VISTA/CARTORIO/JURIDICO |
| `CollectionTask` (model) | Evaluate: LIGACAO. Send: dead letter. Finalizer: SLA alert |
| Eventos `message/sent`, `charge/paid` | Integração com engagement tracking existente |
| `lib/default-dunning-rule.ts` | Templates default continuam servindo como base |

## Novos arquivos

```
lib/batch/
  fire-date.ts          — computeFireDate (business days)
  fire-date.test.ts     — testes unitários
  evaluate.ts           — lógica de avaliação
  evaluate.test.ts
  group.ts              — agrupamento por devedor+canal
  group.test.ts
  send.ts               — freshness check + dispatch + status updates
  send.test.ts
  render.ts             — renderização de mensagem consolidada (single e multi-charge)
  render.test.ts
  circuit-breaker.ts    — checa failure rate do batch, retorna halt/continue

inngest/scheduled/
  batch-orchestrator.ts — cron 8h, status transitions, fan-out
  batch-finalizer.ts    — cron 10h, SLA check, stats compilation

inngest/functions/
  batch-evaluate.ts     — triggered by batch/tenant.ready
  batch-group.ts        — triggered by batch/evaluated
  batch-send.ts         — triggered by batch/group.ready
  cancel-intents-on-payment.ts — triggered by charge/paid
```

## Novos eventos Inngest

```typescript
// Adicionar ao inngest/events.ts

type BatchTenantReadyEvent = {
  data: {
    franqueadoraId: string;
    runDate: string;      // YYYY-MM-DD, calculado no orchestrator, timezone-safe
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

// Adicionar ao Events map:
"batch/tenant.ready": BatchTenantReadyEvent;
"batch/evaluated": BatchEvaluatedEvent;
"batch/group.ready": BatchGroupReadyEvent;
```

## Dry-run

Qualquer operador pode triggerar manualmente:

```bash
# Via Inngest dashboard ou SDK
inngest.send("batch/tenant.ready", {
  franqueadoraId: "xxx",
  runDate: "2026-03-13",
  dryRun: true,
})
```

Com `dryRun: true`:
- Orchestrator não transiciona statuses (ou pode ser rodado manualmente direto no evaluate)
- Evaluate cria intents normalmente
- Group cria groups e renderiza mensagens
- Eventos para send NÃO são emitidos
- Operador pode consultar no banco:
  - `SELECT * FROM communication_intents WHERE batch_run_id = X` — o que dispararia
  - `SELECT * FROM message_groups WHERE batch_run_id = X` — preview das mensagens
- Para prosseguir: emitir `batch/group.ready` manualmente por grupo

## Observabilidade

**Inngest Dashboard:**
- 1 run do orchestrator por dia
- N runs do evaluate (1 por tenant) — visíveis como execuções separadas
- N runs do group
- M runs do send (1 por grupo) — cada um com status de retry

**BatchRun.stats (banco, compilado pelo finalizer via query):**
```json
{
  "intentsCreated": 47,
  "groupsCreated": 12,
  "sent": 10,
  "failed": 1,
  "skipped": 1,
  "escalated": 2,
  "tasksCreated": 3
}
```

**Alertas (via CollectionTask com priority CRITICA):**
- Finalizer: batches não-completos em 2h
- Circuit breaker: failure rate > 20%
- onFailure do send: envio falhou após 3 retries

## Simplificações conscientes (v1)

| O que | Decisão | Quando revisitar |
|---|---|---|
| `channelMode: SMART` | Ignorado — usa canal fixo do step | Quando dados de engagement mostrarem que canal alternativo converte melhor |
| `timingMode: SMART` | Ignorado — envia no horário do cron (8h) | Quando engagement profiles tiverem dados de bestHour suficientes |
| `contentMode: SMART` | Suportado — resolve variante vencedora | N/A (já funciona) |
| Dashboard de batch | Sem UI — consulta via banco ou Inngest dashboard | Quando operadores precisarem de visibilidade self-service |
| Re-cobrança pós-estorno | Bloqueada pela constraint `@@unique([chargeId, stepId])` | Se estornos se tornarem comuns, adicionar campo `cycle` ao intent |

## Fora de escopo

- IA na régua — decisão tomada: régua determinística
- Migração de sagas ativas — não há tráfego real
- Mudança de stack (Prisma → Supabase client) — mantém Prisma
- RLS no banco — mantém isolamento por código
- Novos canais — batch suporta os canais existentes
- Feriados nacionais no cálculo de business days — pode ser adicionado depois via lista de feriados
