# Régua Dinâmica — Motor de Inteligência para Cobrança

**Data:** 2026-03-11
**Status:** Draft
**Projeto:** Menlo Cobrança (cobranca-facil_v2)

## 1. Visão Geral

### Problema

As réguas de cobrança da Menlo hoje são estáticas: cada step define exatamente quando enviar (D-5, D+3), por qual canal (WhatsApp, SMS) e com qual mensagem (template fixo). Todos os devedores do mesmo perfil de risco recebem a mesma jornada, independente do comportamento individual.

A agente Mia (Claude) toma decisões por devedor, mas sem feedback loop — cada decisão é independente, sem aprendizado acumulado. Para escalar para 100K+ devedores por tenant, o custo de LLM por decisão se torna proibitivo.

### Solução: Régua Dinâmica

Evoluir o DunningStep de "execução fixa" para "intenção + resolvers inteligentes". O step define **o quê** (cobrar, fase LEMBRETE, janela D-1) e resolvers decidem **como** (horário, canal, mensagem).

O operador controla o nível de inteligência por step com um toggle simples:
- **Manual** — comportamento atual, ele define tudo
- **Inteligente** — o sistema aprende e otimiza automaticamente

### Abordagem de Implementação: C → B

A evolução é incremental em 3 fases, cada uma entregando valor e gerando dados para a próxima:

| Fase | O quê | Como | Prazo estimado |
|------|--------|------|----------------|
| **1** | Infraestrutura de eventos + heurísticas adaptativas + A/B testing | Regras simples baseadas em engagement data | 4-6 semanas |
| **2** | Multi-armed bandits (Thompson Sampling) | Otimização estatística contínua | +4-6 semanas |
| **3** | Modelos preditivos + LLM cirúrgico | Propensão a pagar, risco de perda, Mia para interações complexas | +8-12 semanas |

A transição entre fases é invisível para o usuário — o toggle continua sendo Manual/Inteligente. A sofisticação do resolver muda internamente.

### Métricas de Sucesso

- **North Star:** Taxa de recuperação (% do valor inadimplente recuperado)
- **Secundárias:** Custo por R$ recuperado, dias médios até pagamento

### Papel da Mia (LLM)

A Mia deixa de ser "cérebro que decide tudo" e passa a ser "especialista chamada quando precisa raciocinar":
- Geração de variantes de mensagem (sob demanda, via botão "Gerar variantes com Mia")
- Respostas a mensagens inbound (conversação)
- Condução de negociação personalizada
- Escalation com contexto rico
- Decisões outbound (timing, canal, variante) passam para resolvers estatísticos

---

## 2. Experiência do Usuário

### 2.1 Princípios

- **Dois modos, não três.** Manual e Inteligente. Sem jargão técnico (bandit, Thompson Sampling, heurística).
- **Resultado, não método.** O chip mostra "⏰ 20:30-21:15 ↑31%" — não "Bandit ativo".
- **Migração granular.** Cada step e cada resolver pode ser Manual ou Inteligente independentemente.
- **Backward compatible.** Steps existentes continuam funcionando sem mudança (modo Manual por padrão).

### 2.2 Tela 1 — Detalhe da Régua

Evolução da página existente `/reguas/[id]`. Mudanças:

**Banner de Inteligência** (novo, topo da página):
- Aparece quando há pelo menos 1 step inteligente
- Mostra KPIs agregados: variação na taxa de recuperação, custo/msg, velocidade
- Link para o Intelligence Dashboard

**Step Card** (evolução do card existente):
- Linha de resolver chips abaixo do template preview
- Chip Manual (cinza): mostra valor fixo ("⏰ 10:00", "✉️ Email", "✍️ 1 template")
- Chip Inteligente (roxo): mostra resultado descoberto ("⏰ 20:30 ↑31%", "📱 WhatsApp 62% ↑22%")
- Step inteligente tem borda roxa sutil
- Click no step expande painel com 3 resolver panels mostrando métricas detalhadas

**Painel expandido do step** (novo):
- Grid 3 colunas: Horário | Canal | Mensagem
- Cada panel mostra: badge "Inteligente", métricas descobertas, barra de confiança
- Panel de mensagem mostra mini-lista de variantes com taxa de conversão

### 2.3 Tela 2 — Editor de Step

Evolução do form existente de criação/edição de step. Modal dialog.

**Configuração Base** (existente):
- Offset (dias), Fase — sem mudança

**Seções de Resolver** (novas, uma por dimensão):

Cada seção tem:
1. **Toggle Manual / Inteligente** — seleção binária com ícones (✋/🧠)
2. **Painel de configuração** que muda conforme o modo selecionado

**⏰ Horário de envio:**
- Manual: campo de horário (time input) — comportamento atual
- Inteligente: mostra resultado descoberto + campo "Horário padrão para novos devedores" (fallback)

**📱 Canal de envio:**
- Manual: select de canal — comportamento atual
- Inteligente: checkboxes de canais elegíveis (mínimo 2) + resultado descoberto

**✍️ Mensagem:**
- Manual: textarea de template — comportamento atual
- Inteligente: editor de variantes (A, B, C, D) + botão "Gerar variantes com Mia" + select de métrica de otimização (taxa de pagamento / resposta / abertura)

### 2.4 Tela 3 — Intelligence Dashboard

Nova página acessível via link no banner de inteligência ou tab na página de réguas.

**KPIs:**
- Taxa de recuperação (vs período anterior)
- Custo por R$ recuperado (vs anterior)
- Dias até pagamento (vs anterior)
- Steps inteligentes (X de Y, total de decisões)

**Performance por Step:**
- Grid de cards, um por step da régua
- Cada card: dia (D-5, D0, D+7), badge Manual/Inteligente, métrica principal, variação

**Melhor Horário (heatmap):**
- Grid dia da semana × faixa horária
- Intensidade de cor = taxa de abertura
- Insight textual: "Melhor faixa: 20:30-21:15"

**Melhor Canal (barras):**
- Barras horizontais por canal com taxa de resposta
- Métrica secundária: taxa de pagamento

**Melhor Mensagem (tabela):**
- Variantes com: preview, enviadas, abriu, respondeu, pagou
- Badge "Melhor" na variante líder
- Badge de confiança (%)

---

## 3. Modelo de Dados

### 3.1 DunningStep — Campos Novos

Adições ao modelo existente (campos existentes não mudam):

```prisma
model DunningStep {
  // ... campos existentes ...

  // Resolver modes
  timingMode    ResolverMode @default(MANUAL)
  channelMode   ResolverMode @default(MANUAL)
  contentMode   ResolverMode @default(MANUAL)

  // Smart timing config
  fallbackTime  String?      @default("10:00")  // HH:MM, usado quando não há dados

  // Smart channel config
  allowedChannels Channel[]  @default([])        // canais elegíveis no modo smart

  // Smart content config
  optimizeFor   OptimizeMetric @default(PAYMENT)  // métrica de otimização
  variants      StepVariant[]                      // variantes de conteúdo

  // Relações novas
  resolverStats StepResolverStats?
}

enum ResolverMode {
  MANUAL
  SMART
}

enum OptimizeMetric {
  PAYMENT    // taxa de pagamento
  RESPONSE   // taxa de resposta
  OPEN       // taxa de abertura
}
```

### 3.2 EngagementEvent — Novo Modelo

Alicerce de toda a inteligência. Cada interação com uma mensagem gera um evento.

```prisma
model EngagementEvent {
  id             String           @id @default(cuid())
  customerId     String
  customer       Customer         @relation(fields: [customerId], references: [id])
  messageQueueId String?
  messageQueue   MessageQueue?    @relation(fields: [messageQueueId], references: [id])
  chargeId       String?
  charge         Charge?          @relation(fields: [chargeId], references: [id])
  stepId         String?
  step           DunningStep?     @relation(fields: [stepId], references: [id])
  variantId      String?
  variant        StepVariant?     @relation(fields: [variantId], references: [id])

  channel        Channel
  eventType      EngagementEventType
  occurredAt     DateTime
  metadata       Json?            // hora local, device info, etc.

  franqueadoraId String
  franqueadora   Franqueadora     @relation(fields: [franqueadoraId], references: [id])

  createdAt      DateTime         @default(now())

  @@index([customerId, eventType, occurredAt])
  @@index([stepId, eventType, occurredAt])
  @@index([variantId, eventType])
  @@index([franqueadoraId, occurredAt])
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

### 3.3 StepVariant — Novo Modelo

Variantes de conteúdo para um step, com stats de performance.

```prisma
model StepVariant {
  id              String        @id @default(cuid())
  stepId          String
  step            DunningStep   @relation(fields: [stepId], references: [id], onDelete: Cascade)

  label           String        // "A", "B", "C", "D"
  template        String        @db.Text
  generatedByAi   Boolean       @default(false)
  active          Boolean       @default(true)

  // Stats (atualizadas pelo batch job)
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

### 3.4 StepResolverStats — Novo Modelo

Stats pré-computadas por step para consulta rápida pelos resolvers.

```prisma
model StepResolverStats {
  id             String      @id @default(cuid())
  stepId         String      @unique
  step           DunningStep @relation(fields: [stepId], references: [id], onDelete: Cascade)

  // Timing stats
  bestHourStart  String?     // "20:30"
  bestHourEnd    String?     // "21:15"
  timingLift     Float?      // 0.31 = +31%
  timingSamples  Int         @default(0)
  timingConfidence Float     @default(0)

  // Channel stats
  bestChannel    Channel?
  channelRates   Json?       // {"WHATSAPP": 0.62, "SMS": 0.28, "EMAIL": 0.11}
  channelLift    Float?
  channelSamples Int         @default(0)
  channelConfidence Float    @default(0)

  // Content stats
  winnerVariantId String?
  contentLift    Float?
  contentSamples Int         @default(0)
  contentConfidence Float    @default(0)

  updatedAt      DateTime    @updatedAt
}
```

### 3.5 CustomerEngagementProfile — Novo Modelo

Perfil de engagement pré-computado por devedor para decisões rápidas.

```prisma
model CustomerEngagementProfile {
  id             String   @id @default(cuid())
  customerId     String   @unique
  customer       Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  // Timing
  bestHour       String?          // hora com maior taxa de abertura
  avgReadDelayMin Int?            // tempo médio até ler (minutos)
  activeHours    Json?            // {"20": 0.73, "21": 0.68, "12": 0.41, ...}

  // Channel
  bestChannel    Channel?
  channelRates   Json?            // {"WHATSAPP": 0.65, "SMS": 0.30, ...}

  // General
  totalMessages  Int     @default(0)
  totalOpens     Int     @default(0)
  totalReplies   Int     @default(0)
  totalPayments  Int     @default(0)
  overallResponseRate Float @default(0)

  updatedAt      DateTime @updatedAt

  @@index([customerId])
}
```

---

## 4. Arquitetura de Processamento

### 4.1 Visão Geral

Inngest como backbone de eventos. Três fluxos principais:

1. **Step Execution** — cron dispara step → resolvers decidem → mensagem agendada → dispatch
2. **Engagement Capture** — webhooks Twilio/Email → grava EngagementEvent → atualiza stats
3. **Intelligence Refresh** — batch jobs agregam eventos → atualizam perfis e stats

### 4.2 Step Execution Flow

```
inngest.createFunction("dunning/run")
  Trigger: cron (configurável por tenant, ex: cada 1h)

  1. Query DunningSteps ativos para o tenant
  2. Query charges elegíveis (PENDING/OVERDUE dentro da janela do step)
  3. Para cada charge/devedor elegível:
     → Emit event "dunning/step.evaluate" { stepId, customerId, chargeId }

inngest.createFunction("dunning/step.evaluate")
  Trigger: event "dunning/step.evaluate"
  Concurrency: { limit: 50, key: "event.data.franqueadoraId" }

  1. Load step config (modes, allowed channels, variants)
  2. Load CustomerEngagementProfile
  3. Resolve timing:
     - MANUAL → step.fallbackTime ou horário fixo existente
     - SMART → profile.bestHour ?? step.fallbackTime
  4. Resolve channel:
     - MANUAL → step.channel
     - SMART → profile.bestChannel ?? step.channel (fallback)
  5. Resolve content:
     - MANUAL → step.template
     - SMART → selectVariant(step.variants, step.optimizeFor)
  6. Create MessageQueue entry com scheduledFor = horário resolvido
  7. → inngest.send("dunning/message.scheduled", { messageQueueId, scheduledFor })

inngest.createFunction("dunning/message.dispatch")
  Trigger: event "dunning/message.scheduled"

  1. inngest.sleep(until: scheduledFor)
  2. Load MessageQueue entry
  3. Dispatch via Twilio/Email (com statusCallback URL)
  4. Gravar EngagementEvent(SENT)
  5. Update MessageQueue status
```

### 4.3 Variant Selection (Fase 1 → Fase 2)

**Fase 1 — Weighted Random:**
```typescript
function selectVariant(variants: StepVariant[], metric: OptimizeMetric): StepVariant {
  const active = variants.filter(v => v.active)
  if (active.length === 1) return active[0]

  // Novos (< 100 envios) recebem peso igual (exploração)
  // Com dados, peso proporcional à taxa de conversão
  const weights = active.map(v => {
    if (v.sends < 100) return 1 // exploração garantida
    return getRate(v, metric) + 0.05 // 5% floor para não morrer
  })

  return weightedRandom(active, weights)
}
```

**Fase 2 — Thompson Sampling (substituição interna, mesma interface):**
```typescript
function selectVariant(variants: StepVariant[], metric: OptimizeMetric): StepVariant {
  const active = variants.filter(v => v.active)
  if (active.length === 1) return active[0]

  // Beta distribution sampling
  const samples = active.map(v => {
    const successes = getSuccesses(v, metric)
    const failures = v.sends - successes
    return {
      variant: v,
      sample: betaSample(successes + 1, failures + 1)
    }
  })

  return maxBy(samples, s => s.sample).variant
}
```

A transição de Fase 1 para 2 é trocar a implementação interna de `selectVariant`. Nenhuma mudança na UI ou no modelo de dados.

### 4.4 Engagement Capture Flow

```
inngest.createFunction("engagement/twilio.status")
  Trigger: event "webhook/twilio.status"

  1. Parse status (delivered, read, failed, undelivered)
  2. Find MessageQueue by providerMsgId
  3. Create EngagementEvent:
     - delivered → DELIVERED
     - read → READ (novo! antes mapeava para DELIVERED)
     - failed/undelivered → FAILED
  4. Update MessageQueue.status

inngest.createFunction("engagement/twilio.inbound")
  Trigger: event "webhook/twilio.inbound"

  1. Find customer by phone
  2. Create EngagementEvent(REPLIED)
  3. Route to existing inbound processing (Mia)

inngest.createFunction("engagement/payment.received")
  Trigger: event "charge/status.changed" where newStatus = PAID

  1. Find last MessageQueue sent for this charge
  2. Create EngagementEvent(PAID)
  3. If linked to a StepVariant → increment conversions
  4. Cancel pending MessageQueue items for this charge
```

### 4.5 Intelligence Refresh (Batch Jobs)

```
inngest.createFunction("intelligence/refresh-stats")
  Trigger: cron "*/15 * * * *" (cada 15 min)

  1. Para cada step com modo SMART:
     a. Agregar EngagementEvents dos últimos 30 dias
     b. Calcular bestHour, bestChannel por step
     c. Recalcular variant rates (opens/sends, conversions/sends)
     d. Determinar isWinner (maior taxa na métrica configurada)
     e. Calcular confiança (sample size + margin)
     f. Upsert StepResolverStats

inngest.createFunction("intelligence/refresh-profiles")
  Trigger: cron "0 */6 * * *" (cada 6h)

  1. Para cada customer com EngagementEvents recentes:
     a. Agregar eventos por hora do dia → activeHours
     b. Determinar bestHour (hora com maior open rate)
     c. Agregar por channel → channelRates
     d. Determinar bestChannel
     e. Upsert CustomerEngagementProfile

inngest.createFunction("intelligence/evaluate-variants")
  Trigger: cron "0 4 * * *" (diário, 4am)

  1. Para cada step com contentMode = SMART:
     a. Se variante com >500 envios e conversionRate < 50% da winner → desativar
     b. Se todas variantes convergidas (confidence > 95%) → logar, manter exploração em 5%
     c. Se nenhuma variante ativa restante → fallback para template do step
```

### 4.6 Escalabilidade

| Componente | 1K devedores | 100K devedores |
|------------|-------------|----------------|
| Step evaluation | Síncrono, ok | Fan-out via Inngest, 50 concurrent por tenant |
| EngagementEvents | ~10K/mês | ~1M/mês, particionar por mês, index em (customerId, eventType, occurredAt) |
| Profile refresh | < 1min | Batch em chunks de 1000, ~15min total |
| Stats refresh | < 30s | Agregar via SQL, ~2min total |
| Variant selection | In-memory | In-memory (stats pré-computadas, < 1ms) |
| Storage | ~100MB/ano | ~10GB/ano, considerar cleanup de eventos > 6 meses |

### 4.7 Infra Necessária (mudanças)

- **Twilio:** Configurar `statusCallback` URL em `sendWhatsApp()` e `sendSms()` para receber delivery/read events
- **Inngest:** Já planejado (docs/plans/2026-03-11-event-driven-architecture.md) — aproveitar a migração
- **MessageQueue:** Adicionar campo `variantId` para rastreabilidade
- **Supabase:** Nenhuma mudança de infra, novos modelos via Prisma migration

---

## 5. Fases de Implementação

### Fase 1 — Fundação + Heurísticas (4-6 semanas)

**Entrega:** Steps com modo Manual/Inteligente funcionando, baseado em regras simples.

1. **Semana 1-2: Infraestrutura de eventos**
   - Criar modelos: EngagementEvent, StepVariant, StepResolverStats, CustomerEngagementProfile
   - Configurar statusCallback no Twilio provider
   - Atualizar webhook de status para gravar EngagementEvents (diferenciar READ de DELIVERED)
   - Gravar EngagementEvent(REPLIED) no webhook inbound
   - Gravar EngagementEvent(PAID) quando charge muda para PAID

2. **Semana 2-3: Resolvers básicos**
   - Adicionar campos ao DunningStep (timingMode, channelMode, contentMode, etc.)
   - Implementar Timing Resolver (MANUAL: horário fixo, SMART: bestHour do perfil)
   - Implementar Channel Resolver (MANUAL: canal fixo, SMART: bestChannel do perfil)
   - Implementar Content Resolver com weighted random selection
   - Integrar resolvers no fluxo de dunning execution

3. **Semana 3-4: Batch jobs**
   - intelligence/refresh-stats (cada 15min)
   - intelligence/refresh-profiles (cada 6h)
   - intelligence/evaluate-variants (diário)

4. **Semana 4-5: UI**
   - Banner de inteligência na página de régua
   - Resolver chips nos step cards
   - Editor de step com toggle Manual/Inteligente
   - Editor de variantes + botão "Gerar variantes com Mia"

5. **Semana 5-6: Intelligence Dashboard**
   - KPIs (recuperação, custo, velocidade, decisões)
   - Grid de performance por step
   - Heatmap de horários
   - Performance por canal
   - Tabela de variantes

### Fase 2 — Multi-Armed Bandits (4-6 semanas após Fase 1)

**Entrega:** Otimização estatística contínua substituindo heurísticas.

1. Implementar Thompson Sampling para variant selection (substituir weighted random)
2. Implementar Thompson Sampling para timing (buckets de horário)
3. Implementar Thompson Sampling para channel selection
4. Adicionar métricas de confiança na UI (barra de confiança)
5. Auto-desativação de variantes perdedoras
6. Convergência automática com redução de exploração

### Fase 3 — Modelos Preditivos + LLM Cirúrgico (8-12 semanas após Fase 2)

**Entrega:** Predição de comportamento + jornadas dinâmicas.

1. Modelo de propensão a pagar (regressão logística sobre features de engagement)
2. Modelo de valor ótimo de desconto
3. Journey Router: redirecionar devedores entre réguas baseado em predição
4. Mia reservada para: inbound, negociação, escalation, geração de variantes
5. Dashboard com scores preditivos por devedor

---

## 6. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Volume insuficiente de dados para convergência | Resolvers smart não melhoram vs manual | Fallback automático para Manual quando dados < threshold. Threshold: 100 envios por variante, 50 eventos por horário bucket |
| Twilio não entrega status callbacks consistentemente | EngagementEvents incompletos | Monitorar taxa de callbacks vs mensagens enviadas. Alertar se < 80%. Fallback para heurística baseada em resposta (REPLIED) |
| Performance do batch job com 1M+ eventos | Stats refresh demora > 15min | Particionar EngagementEvents por mês. Agregar apenas eventos dos últimos 30 dias. Materialized views se necessário |
| Variantes convergem para local optima | Sistema para de melhorar | Manter 5% de exploração mínima. Botão "Gerar novas variantes" para reset manual. Avaliação mensal automática |
| Operador não confia no modo Inteligente | Baixa adoção | Mostrar resultados claros (chips com lift %). Permitir Manual em qualquer step. Intelligence Dashboard como prova |

---

## 7. Fora de Escopo

- Personalização por devedor individual (timing/channel por devedor é Fase 3)
- Integração com novos canais (RCS, push notification)
- Compliance/frequency capping avançado (existe básico via daily limit)
- Real-time triggers (ex: devedor abriu boleto → enviar mensagem imediata)
- Multi-language support para templates

---

## 8. Referências

- Mockups validados: `.superpowers/brainstorm/6293-1773256804/mockup-v2-all.html`
- Plano de event-driven architecture: `docs/plans/2026-03-11-event-driven-architecture.md`
- Braze AI capabilities research (inspiração): Intelligent Timing, Intelligent Channel, Decisioning Studio
- Schema atual: `prisma/schema.prisma`
- Agent orchestrator: `lib/agent/orchestrator.ts`
- Default dunning rules: `lib/default-dunning-rule.ts`
