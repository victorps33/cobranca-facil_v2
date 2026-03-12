# Integração Conta Azul — Arquitetura Multi-ERP

> **Data:** 2026-03-12
> **Status:** Aprovado
> **Objetivo:** Integrar múltiplos ERPs (Omie + Conta Azul) à plataforma Menlo via Adapter Pattern, com sync bidirecional, emissão de NF e polling para ERPs sem webhook.

---

## Seção 1: Arquitetura Multi-ERP

### Interface ERPAdapter

```typescript
interface ERPAdapter {
  // Identidade
  readonly provider: "OMIE" | "CONTA_AZUL";

  // Auth
  authenticate(): Promise<void>;

  // Clientes
  listCustomers(since?: Date): Promise<ERPCustomer[]>;
  getCustomer(erpId: string): Promise<ERPCustomer | null>;
  createCustomer(data: CreateCustomerInput): Promise<ERPCustomer>;
  updateCustomer(erpId: string, data: UpdateCustomerInput): Promise<ERPCustomer>;

  // Cobranças
  listCharges(since?: Date): Promise<ERPCharge[]>;
  getCharge(erpId: string): Promise<ERPCharge | null>;
  createCharge(data: CreateChargeInput): Promise<ERPCharge>;
  updateChargeStatus(erpId: string, status: ChargeStatus): Promise<void>;

  // Nota Fiscal
  createInvoice(chargeId: string, data: CreateInvoiceInput): Promise<ERPInvoice>;
  getInvoice(erpId: string): Promise<ERPInvoice | null>;

  // Webhook (opcional — Conta Azul não suporta)
  parseWebhook?(payload: unknown): ERPWebhookEvent;
}
```

### Tipos Normalizados

```typescript
interface ERPCustomer {
  erpId: string;           // ID no ERP
  name: string;
  doc: string;             // CPF/CNPJ
  email: string;
  phone: string;
  razaoSocial?: string;
  cidade?: string;
  estado?: string;
}

interface ERPCharge {
  erpId: string;
  customerErpId: string;
  description: string;
  amountCents: number;
  amountPaidCents: number;
  dueDate: Date;
  paidAt?: Date;
  status: ChargeStatus;       // Normalizado (PENDING, PAID, OVERDUE, etc.)
  formaPagamento?: string;    // Boleto, Pix, Cartão
  statusRaw: string;          // Status original do ERP
  invoiceNumber?: string;     // Número da NF
  invoiceUrl?: string;        // Link do PDF da NF
}

interface ERPInvoice {
  erpId: string;
  number: string;
  status: "EMITIDA" | "CANCELADA" | "PENDENTE";
  pdfUrl?: string;
  issuedAt?: Date;
}
```

### Factory

```typescript
// lib/integrations/erp-factory.ts
function getERPAdapter(franqueadoraId: string): Promise<ERPAdapter>
```

Busca a config da franqueadora no banco (`erpProvider` + credenciais) e retorna o adapter correto.

### Estrutura de Arquivos

```
lib/integrations/
  types.ts                    ← ERPAdapter interface, tipos normalizados
  erp-factory.ts              ← Factory que retorna adapter por franqueadora
  sync-engine.ts              ← Lógica genérica de sync (usa ERPAdapter)
  omie/
    adapter.ts                ← OmieAdapter implements ERPAdapter
    client.ts                 ← (existente, mantido)
    types.ts                  ← (existente, mantido)
    status-mapper.ts          ← (extraído do existente)
  conta-azul/
    adapter.ts                ← ContaAzulAdapter implements ERPAdapter
    client.ts                 ← HTTP client com OAuth2 + auto-refresh
    types.ts                  ← Tipos da API Conta Azul
    status-mapper.ts          ← Mapeia status Conta Azul → ChargeStatus
```

---

## Seção 2: Modelo de Dados

### Mudanças no Prisma Schema

**Novo enum:**

```prisma
enum ERPProvider {
  OMIE
  CONTA_AZUL
  NONE
}
```

**Nova tabela — ERPConfig (uma por franqueadora):**

```prisma
model ERPConfig {
  id                String       @id @default(cuid())
  franqueadoraId    String       @unique
  franqueadora      Franqueadora @relation(fields: [franqueadoraId], references: [id])
  provider          ERPProvider  @default(NONE)

  // Omie
  omieAppKey        String?      @db.Text
  omieAppSecret     String?      @db.Text
  omieWebhookSecret String?

  // Conta Azul (OAuth2)
  contaAzulClientId     String?
  contaAzulClientSecret String?  @db.Text
  contaAzulAccessToken  String?  @db.Text
  contaAzulRefreshToken String?  @db.Text
  contaAzulTokenExpiresAt DateTime?

  // Sync tracking
  lastSyncAt        DateTime?
  syncIntervalMin   Int          @default(10)
  syncEnabled       Boolean      @default(true)

  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
}
```

**Campos genéricos no Customer (manter campos Omie existentes para retrocompatibilidade):**

```prisma
  erpProvider       ERPProvider?
  erpCustomerId     String?        // ID genérico no ERP (Omie código ou Conta Azul UUID)
  erpLastSyncAt     DateTime?
```

**Campos genéricos no Charge:**

```prisma
  erpProvider       ERPProvider?
  erpChargeId       String?        // ID genérico no ERP
  erpLastSyncAt     DateTime?

  // NF (novos — compartilhados entre ERPs)
  invoiceNumber     String?
  invoiceStatus     String?        // "EMITIDA", "CANCELADA", "PENDENTE"
  invoicePdfUrl     String?
  invoiceIssuedAt   DateTime?
```

**Nota:** Os campos `omieCodigoCliente`, `omieCodigoTitulo`, etc. são mantidos para retrocompatibilidade. Novos ERPs usam os campos genéricos `erpProvider` + `erpCustomerId`/`erpChargeId`.

### Indexes

```prisma
  @@index([erpProvider, erpCustomerId])  // no Customer
  @@index([erpProvider, erpChargeId])    // no Charge
```

---

## Seção 3: Conta Azul — Client e Autenticação

### OAuth2 Flow

A Conta Azul usa OAuth2 Authorization Code. O fluxo:

1. **Admin conecta** — Na UI da Menlo, clica "Conectar Conta Azul" → redireciona para Conta Azul para autorizar
2. **Callback** — Conta Azul redireciona de volta com `code` → Menlo troca por `access_token` + `refresh_token`
3. **Tokens salvos** — Armazenados na tabela `ERPConfig` (criptografados)
4. **Auto-refresh** — O client detecta token expirado (1h) e usa `refresh_token` automaticamente

### Rotas OAuth

```
app/api/integrations/conta-azul/
  authorize/route.ts     ← GET: redireciona para Conta Azul com client_id + scopes
  callback/route.ts      ← GET: recebe code, troca por tokens, salva no ERPConfig
```

### HTTP Client

```typescript
// lib/integrations/conta-azul/client.ts
class ContaAzulClient {
  constructor(private erpConfig: ERPConfig) {}

  // Auto-refresh antes de cada request
  private async ensureValidToken(): Promise<string>

  // Request genérico com retry e rate limit (600/min)
  async request<T>(method: string, path: string, body?: unknown): Promise<T>

  // Paginação automática
  async requestAllPages<T>(path: string, params?: Record<string, string>): Promise<T[]>
}
```

### Rate Limiting

- Conta Azul: **600 req/min**, **10 req/s** por conta
- Implementar com delay de 100ms entre requests (max 10/s)
- Retry com backoff em HTTP 429

### Status Mapper

```
Conta Azul → ChargeStatus:
  PENDING / EM_ABERTO     → PENDING
  OVERDUE / VENCIDO        → OVERDUE
  ACQUITTED / LIQUIDADO    → PAID
  PARTIALLY_ACQUITTED      → PARTIAL
  CANCELLED / CANCELADO    → CANCELED
```

---

## Seção 4: Sincronização e Polling

### Sync Engine Genérico

Como a Conta Azul não tem webhooks, usamos polling via Inngest scheduled function. O Omie continua usando webhook + polling como fallback.

```typescript
// lib/integrations/sync-engine.ts
async function syncFranqueadora(franqueadoraId: string): Promise<SyncResult> {
  const adapter = await getERPAdapter(franqueadoraId);
  const config = await getERPConfig(franqueadoraId);

  // 1. Sync clientes alterados desde lastSyncAt
  const customers = await adapter.listCustomers(config.lastSyncAt);
  // → upsert no banco + emit customer/created ou customer/updated

  // 2. Sync cobranças alteradas desde lastSyncAt
  const charges = await adapter.listCharges(config.lastSyncAt);
  // → upsert no banco + emit charge/created, charge/paid, etc.

  // 3. Atualizar lastSyncAt
  await updateLastSyncAt(franqueadoraId);

  return { customersSync, chargesSync };
}
```

### Inngest Scheduled Functions

**Polling (para ERPs sem webhook — Conta Azul):**

```typescript
// inngest/scheduled/erp-poll-sync.ts
// Roda a cada 10 minutos
{ cron: "*/10 * * * *" }

// Para cada franqueadora com syncEnabled=true e provider != NONE:
//   → step.run(`sync-${franqueadoraId}`) → syncFranqueadora()
// Paginado por franqueadora para não estourar timeout
```

**Sync bidirecional (Menlo → ERP):**

Quando um cliente/cobrança é criado na Menlo, o evento existente (`charge/created`, `customer/created`) dispara uma nova reactive function:

```typescript
// inngest/functions/erp-push-sync.ts
// Triggers: charge/created, charge/updated, customer/created, customer/updated
// → getERPAdapter(franqueadoraId) → adapter.createCharge() ou adapter.updateCustomer()
```

### Omie Webhook (mantido)

O webhook do Omie continua funcionando como hoje. A diferença é que `processOmieWebhook` é encapsulado dentro do `OmieAdapter` e o saga `omie-sync` chama o sync engine genérico.

### Fluxo de Dados

```
ERP → Menlo (Pull):
  Inngest cron (10min) → erp-poll-sync → adapter.listCharges(since) → upsert DB → emit events

Menlo → ERP (Push):
  API route → emit charge/created → erp-push-sync → adapter.createCharge() → ERP

Omie Webhook (mantido):
  Omie → POST /webhook → emit integration/omie-webhook-received → omie-sync saga → sync engine
```

### Conflitos

Para sync bidirecional, a estratégia é **last-write-wins com timestamp**:
- Cada registro tem `erpLastSyncAt` e `updatedAt`
- Se `erpLastSyncAt > updatedAt` → ERP é mais recente, atualiza Menlo
- Se `updatedAt > erpLastSyncAt` → Menlo é mais recente, push para ERP

---

## Seção 5: Nota Fiscal e Emissão via ERP

### Fluxo de Emissão

```
Operador na Menlo → Clica "Emitir NF" → POST /api/charges/[id]/invoice
  → emit "charge/invoice-requested"
  → Inngest function: erp-create-invoice
  → adapter.createInvoice(chargeId, data)
  → ERP processa e retorna número/status
  → Atualiza Charge (invoiceNumber, invoiceStatus, invoicePdfUrl)
```

### Novos Eventos Inngest

```typescript
"charge/invoice-requested": {
  data: {
    chargeId: string;
    franqueadoraId: string;
    customerId: string;
  };
}

"charge/invoice-issued": {
  data: {
    chargeId: string;
    invoiceNumber: string;
    invoicePdfUrl?: string;
    franqueadoraId: string;
  };
}
```

### Polling de Status da NF

Como a Conta Azul processa criação de NF de forma assíncrona (retorna HTTP 202 com `protocolId`), a Inngest function faz:

1. `step.run("request-invoice")` → Chama API, recebe `protocolId`
2. `step.sleep("wait-processing", "30s")` → Aguarda processamento
3. `step.run("check-invoice-status")` → Consulta status pelo `protocolId`
4. Se ainda PENDING → repete com backoff (max 5 tentativas)
5. Se SUCCESS → Atualiza Charge com `invoiceNumber`, `invoiceStatus`, `invoicePdfUrl`

### Dados da NF na UI

Os campos `invoiceNumber`, `invoiceStatus`, `invoicePdfUrl` e `invoiceIssuedAt` no modelo Charge são exibidos na UI de detalhe da cobrança. O `nfEmitida` existente é derivado de `invoiceStatus === "EMITIDA"`.

### Adapter Interface (complemento)

```typescript
interface ERPAdapter {
  // NF
  createInvoice(chargeId: string, data: CreateInvoiceInput): Promise<ERPInvoice>;
  getInvoice(erpId: string): Promise<ERPInvoice | null>;
  getInvoicePdf?(erpId: string): Promise<string>; // URL do PDF
}
```

---

## Seção 6: Refatoração do Omie e Migração

### OmieAdapter

A lógica existente em `lib/integrations/omie/` é encapsulada dentro de uma classe que implementa `ERPAdapter`:

```typescript
// lib/integrations/omie/adapter.ts
class OmieAdapter implements ERPAdapter {
  readonly provider = "OMIE";

  constructor(private config: ERPConfig) {}

  // Reutiliza funções existentes:
  // - client.ts → omieRequest(), fetchOmieCliente(), fetchOmieTitulo()
  // - sync.ts → syncOmieCustomers(), syncOmieTitles()
  // - processWebhook.ts → processOmieWebhook()
  // - statusMapper (mapOmieStatus)

  async listCustomers(since?: Date) { /* usa omieRequestAllPages */ }
  async listCharges(since?: Date) { /* usa omieRequestAllPages */ }
  async createCustomer(data) { /* usa omieRequest com IncluirCliente */ }
  async createCharge(data) { /* usa omieRequest com IncluirContaReceber */ }
  async createInvoice(chargeId, data) { /* usa API NFS-e do Omie */ }

  // Webhook (Omie suporta)
  parseWebhook(payload) { /* reusa processOmieWebhook */ }
}
```

### Migração do Saga omie-sync

O saga `inngest/sagas/omie-sync.ts` atual é mantido para processar webhooks do Omie. Internamente, passa a chamar o sync engine genérico:

```typescript
// Antes: processOmieWebhook(payload) direto
// Depois: const adapter = await getERPAdapter(franqueadoraId);
//         adapter.parseWebhook(payload) → sync engine
```

### O Que NÃO Muda

- Rota de webhook do Omie (`/api/integrations/omie/webhook`) — mantida
- Evento `integration/omie-webhook-received` — mantido
- Campos `omieCodigoCliente`, `omieCodigoTitulo` no schema — mantidos (retrocompatibilidade)
- Funcionalidade de boleto do Omie — mantida

### Estratégia de Migração de Dados

Para franqueadoras que já usam Omie, os campos genéricos (`erpProvider`, `erpCustomerId`, `erpChargeId`) são preenchidos com uma migration:

```sql
UPDATE "Customer"
SET "erpProvider" = 'OMIE',
    "erpCustomerId" = "omie_codigo_cliente"::text
WHERE "omie_codigo_cliente" IS NOT NULL;
```

---

## Seção 7: Estrutura Final, Eventos e Concorrência

### Novos Arquivos

```
lib/integrations/
  types.ts                          ← ERPAdapter interface, ERPCustomer, ERPCharge, ERPInvoice
  erp-factory.ts                    ← getERPAdapter(franqueadoraId)
  sync-engine.ts                    ← syncFranqueadora() — lógica genérica de sync
  conta-azul/
    adapter.ts                      ← ContaAzulAdapter implements ERPAdapter
    client.ts                       ← HTTP client OAuth2 + auto-refresh + rate limit
    types.ts                        ← Tipos da API Conta Azul
    status-mapper.ts                ← mapContaAzulStatus()

app/api/integrations/conta-azul/
  authorize/route.ts                ← GET: redireciona para OAuth
  callback/route.ts                 ← GET: troca code por tokens

app/api/charges/[id]/invoice/
  route.ts                          ← POST: solicita emissão de NF

inngest/
  scheduled/erp-poll-sync.ts        ← Cron 10min: polling para ERPs sem webhook
  functions/erp-push-sync.ts        ← Reactive: push Menlo → ERP em charge/customer events
  functions/erp-create-invoice.ts   ← Reactive: emite NF no ERP
```

### Arquivos Modificados

```
lib/integrations/omie/
  adapter.ts                        ← NOVO: OmieAdapter implements ERPAdapter
  (demais arquivos mantidos)

inngest/sagas/omie-sync.ts          ← Usa sync engine genérico
inngest/events.ts                   ← Adiciona charge/invoice-requested, charge/invoice-issued
inngest/index.ts                    ← Registra novas funções

prisma/schema.prisma                ← ERPProvider enum, ERPConfig model, campos genéricos
middleware.ts                       ← Exclui rota conta-azul/callback do auth
```

### Novos Eventos Inngest

| Evento | Origem | Consumidor |
|--------|--------|------------|
| `charge/invoice-requested` | POST /api/charges/[id]/invoice | erp-create-invoice |
| `charge/invoice-issued` | erp-create-invoice | notify-payment-received (atualiza UI) |
| `integration/erp-sync-completed` | erp-poll-sync | (observabilidade) |

### Error Handling

| Função | Retries | onFailure |
|--------|---------|-----------|
| erp-poll-sync | 3 | CollectionTask ALTA |
| erp-push-sync | 3 | CollectionTask ALTA (dados ficam dessincronizados) |
| erp-create-invoice | 5 | CollectionTask CRITICA (NF não emitida) |

### Concurrency

| Função | Key | Limit |
|--------|-----|-------|
| erp-poll-sync | franqueadoraId | 1 |
| erp-push-sync | event.data.chargeId ou customerId | 1 |
| erp-create-invoice | event.data.chargeId | 1 |
