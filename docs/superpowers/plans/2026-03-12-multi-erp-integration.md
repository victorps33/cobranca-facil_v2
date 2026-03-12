# Multi-ERP Integration (Conta Azul + Omie Refactoring) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Conta Azul ERP via Adapter Pattern, enabling multi-ERP support (Omie + Conta Azul) with bidirectional sync, invoice emission, and per-franqueadora ERP configuration.

**Architecture:** Adapter Pattern with ERPAdapter interface. Each ERP (Omie, Conta Azul) implements the interface. A generic sync engine handles pull/push sync via Inngest. Conta Azul uses OAuth2 + polling (no webhooks). Omie keeps its existing webhook flow, wrapped in an OmieAdapter.

**Tech Stack:** Next.js 14, Prisma 5 (PostgreSQL), Inngest 3, TypeScript 5, Conta Azul API v2, Omie API v1

**Spec:** `docs/superpowers/specs/2026-03-12-conta-azul-multi-erp-design.md`

**Important context:**
- This project has NO testing framework (no Jest/Vitest). Verification is done via `npx tsc --noEmit` for type-checking and runtime testing via dev server.
- The existing Omie integration reads credentials from env vars (`OMIE_APP_KEY`, `OMIE_APP_SECRET`). The OmieAdapter wraps existing functions and maintains backward compatibility.
- Middleware already excludes `/api/integrations/*` from NextAuth — no changes needed for OAuth routes.
- All Inngest functions follow established patterns: concurrency keys, onFailure handlers creating CollectionTask, try/catch on inngest.send().

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `lib/integrations/types.ts` | ERPAdapter interface, normalized types (ERPCustomer, ERPCharge, ERPInvoice), input types |
| `lib/integrations/erp-factory.ts` | `getERPAdapter(franqueadoraId)` factory function |
| `lib/integrations/sync-engine.ts` | Generic `syncFranqueadora()` — pull sync logic using ERPAdapter |
| `lib/integrations/conta-azul/types.ts` | Conta Azul API response types |
| `lib/integrations/conta-azul/status-mapper.ts` | `mapContaAzulStatus()` |
| `lib/integrations/conta-azul/client.ts` | `ContaAzulClient` class — OAuth2, auto-refresh, rate limit, pagination |
| `lib/integrations/conta-azul/adapter.ts` | `ContaAzulAdapter implements ERPAdapter` |
| `lib/integrations/omie/adapter.ts` | `OmieAdapter implements ERPAdapter` (wraps existing functions) |
| `app/api/integrations/conta-azul/authorize/route.ts` | GET: redirect to Conta Azul OAuth |
| `app/api/integrations/conta-azul/callback/route.ts` | GET: exchange code for tokens |
| `app/api/charges/[id]/invoice/route.ts` | POST: request invoice emission |
| `inngest/scheduled/erp-poll-sync.ts` | Cron every 10min: pull sync for polling-based ERPs |
| `inngest/functions/erp-push-sync.ts` | Reactive: push changes from Menlo → ERP |
| `inngest/functions/erp-create-invoice.ts` | Reactive: create invoice in ERP with async polling |

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add ERPProvider enum, ERPConfig model, generic ERP fields on Customer/Charge, relation on Franqueadora |
| `inngest/events.ts` | Add 3 new event types |
| `inngest/index.ts` | Register 3 new functions |
| `inngest/sagas/omie-sync.ts` | Minor: add erpProvider/erpCustomerId population |

---

## Chunk 1: Foundation

### Task 1: Prisma Schema — ERPProvider Enum and ERPConfig Model

**Files:**
- Modify: `prisma/schema.prisma`

**Context:** The schema currently has Omie-specific fields on Customer (lines 112-114) and Charge (lines 155-159). We need to add a generic ERP layer while keeping backward compatibility. The Franqueadora model (lines 515-542) needs a relation to ERPConfig.

- [ ] **Step 1: Add ERPProvider enum**

Add after the `ChargeStatus` enum (line 188) in `prisma/schema.prisma`:

```prisma
enum ERPProvider {
  OMIE
  CONTA_AZUL
  NONE
}
```

- [ ] **Step 2: Add ERPConfig model**

Add after the new enum in `prisma/schema.prisma`:

```prisma
model ERPConfig {
  id                String       @id @default(cuid())
  franqueadoraId    String       @unique
  franqueadora      Franqueadora @relation(fields: [franqueadoraId], references: [id])
  provider          ERPProvider  @default(NONE)

  // Omie credentials
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

- [ ] **Step 3: Add erpConfig relation to Franqueadora**

In the Franqueadora model (around line 536, after `agentConfig`), add:

```prisma
  erpConfig              ERPConfig?
```

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit`
Expected: No new errors (Prisma client not yet generated)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(erp): add ERPProvider enum and ERPConfig model"
```

---

### Task 2: Prisma Schema — Generic ERP Fields on Customer and Charge

**Files:**
- Modify: `prisma/schema.prisma`

**Context:** Customer has Omie-specific fields at lines 112-114. Charge has them at lines 155-159. We add generic ERP fields alongside (keeping the Omie ones for backward compatibility). The Customer model currently lacks `updatedAt` — we add it here since the sync engine needs it for last-write-wins conflict resolution.

- [ ] **Step 1: Add updatedAt and generic ERP fields to Customer**

In the Customer model, after the `omieLastSyncAt` field (line 114), add:

```prisma
  updatedAt             DateTime     @updatedAt
  erpProvider           ERPProvider?
  erpCustomerId         String?
  erpLastSyncAt         DateTime?
```

- [ ] **Step 2: Add composite index for Customer ERP lookup**

In the Customer model, after the existing `@@index([whatsappPhone])` (line 118), add:

```prisma
  @@index([erpProvider, erpCustomerId])
```

- [ ] **Step 3: Add generic ERP fields to Charge**

In the Charge model, after the `amountPaidCents` field (line 159), add:

```prisma
  erpProvider           ERPProvider?
  erpChargeId           String?
  erpLastSyncAt         DateTime?
  invoiceNumber         String?
  invoiceStatus         String?
  invoicePdfUrl         String?
  invoiceIssuedAt       DateTime?
```

- [ ] **Step 4: Add composite index for Charge ERP lookup**

In the Charge model, after the existing `@@index([status, dueDate])` (line 164), add:

```prisma
  @@index([erpProvider, erpChargeId])
```

- [ ] **Step 5: Generate migration**

Run: `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/$(date +%Y%m%d)_add_erp_config/migration.sql`

If that fails, use:

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d)_add_erp_config
npx prisma migrate diff --from-migrations-directory prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/$(date +%Y%m%d)_add_erp_config/migration.sql
```

- [ ] **Step 6: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

- [ ] **Step 7: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors — existing code doesn't reference new fields yet)

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(erp): add generic ERP fields to Customer and Charge models"
```

---

### Task 3: ERPAdapter Interface and Normalized Types

**Files:**
- Create: `lib/integrations/types.ts`

**Context:** This is the core abstraction. All adapters implement `ERPAdapter`. The normalized types are the contract between adapters and the sync engine. We use `ChargeStatus` from Prisma directly.

- [ ] **Step 1: Create the types file**

Create `lib/integrations/types.ts`:

```typescript
import type { ChargeStatus, ERPProvider } from "@prisma/client";

// ---------------------------------------------------------------------------
// Normalized types — the contract between ERPAdapter and sync engine
// ---------------------------------------------------------------------------

export interface ERPCustomer {
  erpId: string;
  name: string;
  doc: string;
  email: string;
  phone: string;
  razaoSocial?: string;
  cidade?: string;
  estado?: string;
}

export interface ERPCharge {
  erpId: string;
  customerErpId: string;
  description: string;
  amountCents: number;
  amountPaidCents: number;
  dueDate: Date;
  paidAt?: Date;
  status: ChargeStatus;
  formaPagamento?: string;
  statusRaw: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
}

export interface ERPInvoice {
  erpId: string;
  number: string;
  status: "EMITIDA" | "CANCELADA" | "PENDENTE";
  pdfUrl?: string;
  issuedAt?: Date;
}

// ---------------------------------------------------------------------------
// Input types — for creating/updating records in the ERP
// ---------------------------------------------------------------------------

export interface CreateCustomerInput {
  name: string;
  doc: string;
  email: string;
  phone: string;
  razaoSocial?: string;
  cidade?: string;
  estado?: string;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export interface CreateChargeInput {
  customerErpId: string;
  description: string;
  amountCents: number;
  dueDate: Date;
  formaPagamento?: string;
}

export interface CreateInvoiceInput {
  customerErpId: string;
  amountCents: number;
  description: string;
  serviceCode?: string;
}

// ---------------------------------------------------------------------------
// Webhook event type (optional — ERPs without webhooks skip this)
// ---------------------------------------------------------------------------

export interface ERPWebhookEvent {
  type: "customer" | "charge";
  action: "created" | "updated" | "deleted";
  erpId: string;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ERPAdapter interface — the core abstraction
// ---------------------------------------------------------------------------

export interface ERPAdapter {
  readonly provider: ERPProvider;

  // Auth
  authenticate(): Promise<void>;

  // Customers
  listCustomers(since?: Date): Promise<ERPCustomer[]>;
  getCustomer(erpId: string): Promise<ERPCustomer | null>;
  createCustomer(data: CreateCustomerInput): Promise<ERPCustomer>;
  updateCustomer(erpId: string, data: UpdateCustomerInput): Promise<ERPCustomer>;

  // Charges
  listCharges(since?: Date): Promise<ERPCharge[]>;
  getCharge(erpId: string): Promise<ERPCharge | null>;
  createCharge(data: CreateChargeInput): Promise<ERPCharge>;
  updateChargeStatus(erpId: string, status: ChargeStatus): Promise<void>;

  // Invoices
  createInvoice(chargeId: string, data: CreateInvoiceInput): Promise<ERPInvoice>;
  getInvoice(erpId: string): Promise<ERPInvoice | null>;

  // Webhook (optional — Conta Azul doesn't support)
  parseWebhook?(payload: unknown): ERPWebhookEvent;
}

// ---------------------------------------------------------------------------
// Sync result type
// ---------------------------------------------------------------------------

export interface SyncResult {
  customersCreated: number;
  customersUpdated: number;
  customersErrors: number;
  chargesCreated: number;
  chargesUpdated: number;
  chargesErrors: number;
  errorDetails: string[];
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/integrations/types.ts
git commit -m "feat(erp): add ERPAdapter interface and normalized types"
```

---

### Task 4: Conta Azul API Types and Status Mapper

**Files:**
- Create: `lib/integrations/conta-azul/types.ts`
- Create: `lib/integrations/conta-azul/status-mapper.ts`

**Context:** Conta Azul API v2 returns data in specific shapes. We define TypeScript types for API responses, then map their statuses to our internal `ChargeStatus` enum. Reference: Conta Azul API at `api-v2.contaazul.com/v1/`.

- [ ] **Step 1: Create Conta Azul API types**

Create `lib/integrations/conta-azul/types.ts`:

```typescript
// ---------------------------------------------------------------------------
// Conta Azul API v2 response types
// Base URL: https://api-v2.contaazul.com/v1/
// ---------------------------------------------------------------------------

export interface ContaAzulCustomer {
  id: string;
  name: string;
  company_name?: string;
  document?: string;       // CPF or CNPJ
  identity_document?: string;
  email?: string;
  business_phone?: string;
  mobile_phone?: string;
  person_type: "NATURAL" | "LEGAL";
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    zip_code?: string;
    city?: {
      name?: string;
    };
    state?: {
      name?: string;
      abbreviation?: string;
    };
  };
  created_at?: string;
  updated_at?: string;
}

export interface ContaAzulSale {
  id: string;
  number?: number;
  status: string;          // PENDING, COMMITTED, etc.
  customer_id: string;
  emission?: string;       // ISO date
  due_date?: string;
  total: number;
  total_paid?: number;
  payment?: {
    type?: string;         // BOLETO, PIX, CREDIT_CARD, etc.
    installments?: number;
  };
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContaAzulReceivable {
  id: string;
  document_number?: string;
  status: string;           // PENDING, OVERDUE, ACQUITTED, PARTIALLY_ACQUITTED, CANCELLED
  customer_id: string;
  due_date: string;
  value: number;
  paid_value?: number;
  payment_date?: string;
  description?: string;
  category?: {
    id?: string;
    name?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface ContaAzulService {
  id: string;
  name: string;
  code?: string;
  cost?: number;
}

export interface ContaAzulServiceInvoice {
  id: string;
  protocol_id?: string;     // Used for async status checking
  status: string;            // PENDING, ISSUED, CANCELLED, ERROR
  number?: string;
  service_value: number;
  customer_id: string;
  issue_date?: string;
  pdf_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContaAzulTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;        // seconds (typically 3600 = 1h)
  token_type: string;
}

// ---------------------------------------------------------------------------
// Pagination — Conta Azul uses Link header for pagination
// ---------------------------------------------------------------------------

export interface ContaAzulPaginatedResponse<T> {
  data: T[];
  hasNext: boolean;
  nextUrl?: string;
}

// ---------------------------------------------------------------------------
// Error response
// ---------------------------------------------------------------------------

export interface ContaAzulError {
  error?: string;
  error_description?: string;
  message?: string;
  status?: number;
}
```

- [ ] **Step 2: Create Conta Azul status mapper**

Create `lib/integrations/conta-azul/status-mapper.ts`:

```typescript
import type { ChargeStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Maps Conta Azul receivable status to internal ChargeStatus
// ---------------------------------------------------------------------------

const CONTA_AZUL_STATUS_MAP: Record<string, ChargeStatus> = {
  PENDING: "PENDING",
  EM_ABERTO: "PENDING",
  OVERDUE: "OVERDUE",
  VENCIDO: "OVERDUE",
  ACQUITTED: "PAID",
  LIQUIDADO: "PAID",
  PARTIALLY_ACQUITTED: "PARTIAL",
  CANCELLED: "CANCELED",
  CANCELADO: "CANCELED",
};

export function mapContaAzulStatus(status: string): ChargeStatus {
  const normalized = status.toUpperCase().trim();
  return CONTA_AZUL_STATUS_MAP[normalized] ?? "PENDING";
}
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/integrations/conta-azul/types.ts lib/integrations/conta-azul/status-mapper.ts
git commit -m "feat(conta-azul): add API types and status mapper"
```

---

## Chunk 2: Clients and Adapters

### Task 5: Conta Azul HTTP Client

**Files:**
- Create: `lib/integrations/conta-azul/client.ts`

**Context:** Conta Azul uses OAuth2 Authorization Code flow. Tokens expire in 1h (access) and 2 weeks (refresh). Rate limit: 600 req/min, 10 req/s. The client auto-refreshes tokens and handles pagination via Link headers. It stores refreshed tokens back in ERPConfig.

- [ ] **Step 1: Create the client file**

Create `lib/integrations/conta-azul/client.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import type { ERPConfig } from "@prisma/client";
import type {
  ContaAzulTokenResponse,
  ContaAzulError,
} from "./types";

// ---------------------------------------------------------------------------
// Conta Azul API v2 HTTP Client
// OAuth2 with auto-refresh, rate limiting, and pagination
// ---------------------------------------------------------------------------

const BASE_URL = "https://api-v2.contaazul.com/v1";
const TOKEN_URL = "https://api-v2.contaazul.com/oauth2/token";
const AUTHORIZE_URL = "https://api-v2.contaazul.com/oauth2/authorize";

const REQUEST_DELAY_MS = 100; // 10 req/s max
const REQUEST_TIMEOUT_MS = 30_000;

export { AUTHORIZE_URL };

export class ContaAzulClient {
  private accessToken: string | null;
  private refreshToken: string | null;
  private tokenExpiresAt: Date | null;
  private clientId: string;
  private clientSecret: string;
  private erpConfigId: string;
  private lastRequestAt = 0;

  constructor(erpConfig: ERPConfig) {
    if (!erpConfig.contaAzulClientId || !erpConfig.contaAzulClientSecret) {
      throw new Error("[Conta Azul] Missing clientId or clientSecret in ERPConfig");
    }
    this.clientId = erpConfig.contaAzulClientId;
    this.clientSecret = erpConfig.contaAzulClientSecret;
    this.accessToken = erpConfig.contaAzulAccessToken;
    this.refreshToken = erpConfig.contaAzulRefreshToken;
    this.tokenExpiresAt = erpConfig.contaAzulTokenExpiresAt;
    this.erpConfigId = erpConfig.id;
  }

  // ── Token management ──

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return true;
    // Refresh 5 minutes before expiry
    return new Date() >= new Date(this.tokenExpiresAt.getTime() - 5 * 60 * 1000);
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error("[Conta Azul] No refresh token available — re-authorize required");
    }

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as ContaAzulError;
      throw new Error(
        `[Conta Azul] Token refresh failed: ${res.status} ${err.error_description || err.error || ""}`
      );
    }

    const tokens = (await res.json()) as ContaAzulTokenResponse;
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    this.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Persist refreshed tokens
    await prisma.eRPConfig.update({
      where: { id: this.erpConfigId },
      data: {
        contaAzulAccessToken: tokens.access_token,
        contaAzulRefreshToken: tokens.refresh_token,
        contaAzulTokenExpiresAt: this.tokenExpiresAt,
      },
    });
  }

  private async ensureValidToken(): Promise<string> {
    if (!this.accessToken || this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
    return this.accessToken!;
  }

  // ── Rate limiting ──

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < REQUEST_DELAY_MS) {
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  // ── HTTP methods ──

  async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    await this.throttle();
    const token = await this.ensureValidToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // Rate limit — retry with backoff
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
        console.warn(`[Conta Azul] Rate limited, waiting ${retryAfter}s`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        return this.request<T>(method, path, body);
      }

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as ContaAzulError;
        throw new Error(
          `[Conta Azul] HTTP ${res.status} ${method} ${path}: ${errBody.message || errBody.error_description || errBody.error || res.statusText}`
        );
      }

      // 204 No Content or 202 Accepted with no body
      const text = await res.text();
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  // ── Pagination ──

  async getAllPages<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const allRecords: T[] = [];
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    let url: string | null = `${path}${query}`;
    let page = 1;

    while (url) {
      await this.throttle();
      const token = await this.ensureValidToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
        const res = await fetch(fullUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }

        if (!res.ok) {
          throw new Error(`[Conta Azul] Pagination HTTP ${res.status} page ${page}`);
        }

        const data = (await res.json()) as T[];
        allRecords.push(...data);

        // Conta Azul uses Link header for pagination
        const linkHeader = res.headers.get("Link");
        url = this.parseNextLink(linkHeader);
        page++;
      } finally {
        clearTimeout(timeout);
      }
    }

    return allRecords;
  }

  private parseNextLink(linkHeader: string | null): string | null {
    if (!linkHeader) return null;
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    return match ? match[1] : null;
  }
}

// ---------------------------------------------------------------------------
// Static helper for exchanging authorization code for tokens
// ---------------------------------------------------------------------------

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<ContaAzulTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ContaAzulError;
    throw new Error(
      `[Conta Azul] Token exchange failed: ${res.status} ${err.error_description || err.error || ""}`
    );
  }

  return (await res.json()) as ContaAzulTokenResponse;
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/integrations/conta-azul/client.ts
git commit -m "feat(conta-azul): add HTTP client with OAuth2, rate limiting, and pagination"
```

---

### Task 6: ContaAzulAdapter

**Files:**
- Create: `lib/integrations/conta-azul/adapter.ts`

**Context:** Implements ERPAdapter using ContaAzulClient. Maps between Conta Azul API types and our normalized types. Conta Azul API endpoints: `/customers`, `/receivables`, `/services/invoices`.

- [ ] **Step 1: Create the adapter**

Create `lib/integrations/conta-azul/adapter.ts`:

```typescript
import type { ERPConfig } from "@prisma/client";
import type {
  ERPAdapter,
  ERPCustomer,
  ERPCharge,
  ERPInvoice,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateChargeInput,
  CreateInvoiceInput,
} from "../types";
import type { ChargeStatus } from "@prisma/client";
import { ContaAzulClient } from "./client";
import { mapContaAzulStatus } from "./status-mapper";
import type {
  ContaAzulCustomer,
  ContaAzulReceivable,
  ContaAzulServiceInvoice,
} from "./types";

// ---------------------------------------------------------------------------
// ContaAzulAdapter — implements ERPAdapter for Conta Azul ERP
// ---------------------------------------------------------------------------

export class ContaAzulAdapter implements ERPAdapter {
  readonly provider = "CONTA_AZUL" as const;
  private client: ContaAzulClient;

  constructor(erpConfig: ERPConfig) {
    this.client = new ContaAzulClient(erpConfig);
  }

  async authenticate(): Promise<void> {
    // OAuth2 tokens are managed by the client automatically
    // This call validates the token is usable
    await this.client.get("/customers?page_size=1");
  }

  // ── Customers ──

  async listCustomers(since?: Date): Promise<ERPCustomer[]> {
    const params: Record<string, string> = { page_size: "200" };
    if (since) {
      params.updated_since = since.toISOString();
    }
    const customers = await this.client.getAllPages<ContaAzulCustomer>(
      "/customers",
      params
    );
    return customers.map(this.mapCustomer);
  }

  async getCustomer(erpId: string): Promise<ERPCustomer | null> {
    try {
      const customer = await this.client.get<ContaAzulCustomer>(
        `/customers/${erpId}`
      );
      return this.mapCustomer(customer);
    } catch {
      return null;
    }
  }

  async createCustomer(data: CreateCustomerInput): Promise<ERPCustomer> {
    const body = {
      name: data.name,
      company_name: data.razaoSocial || data.name,
      document: data.doc,
      email: data.email,
      mobile_phone: data.phone,
      person_type: data.doc.length > 11 ? "LEGAL" : "NATURAL",
      address: {
        city: data.cidade ? { name: data.cidade } : undefined,
        state: data.estado ? { abbreviation: data.estado } : undefined,
      },
    };
    const created = await this.client.post<ContaAzulCustomer>("/customers", body);
    return this.mapCustomer(created);
  }

  async updateCustomer(
    erpId: string,
    data: UpdateCustomerInput
  ): Promise<ERPCustomer> {
    const body: Record<string, unknown> = {};
    if (data.name) body.name = data.name;
    if (data.doc) body.document = data.doc;
    if (data.email) body.email = data.email;
    if (data.phone) body.mobile_phone = data.phone;
    if (data.razaoSocial) body.company_name = data.razaoSocial;

    const updated = await this.client.put<ContaAzulCustomer>(
      `/customers/${erpId}`,
      body
    );
    return this.mapCustomer(updated);
  }

  // ── Charges (Receivables) ──

  async listCharges(since?: Date): Promise<ERPCharge[]> {
    const params: Record<string, string> = { page_size: "200" };
    if (since) {
      params.updated_since = since.toISOString();
    }
    const receivables = await this.client.getAllPages<ContaAzulReceivable>(
      "/receivables",
      params
    );
    return receivables.map(this.mapCharge);
  }

  async getCharge(erpId: string): Promise<ERPCharge | null> {
    try {
      const receivable = await this.client.get<ContaAzulReceivable>(
        `/receivables/${erpId}`
      );
      return this.mapCharge(receivable);
    } catch {
      return null;
    }
  }

  async createCharge(data: CreateChargeInput): Promise<ERPCharge> {
    const body = {
      customer_id: data.customerErpId,
      description: data.description,
      value: data.amountCents / 100,
      due_date: data.dueDate.toISOString().split("T")[0],
    };
    const created = await this.client.post<ContaAzulReceivable>(
      "/receivables",
      body
    );
    return this.mapCharge(created);
  }

  async updateChargeStatus(erpId: string, status: ChargeStatus): Promise<void> {
    // Conta Azul uses specific endpoints for status changes
    if (status === "CANCELED") {
      await this.client.put(`/receivables/${erpId}`, { status: "CANCELLED" });
    }
    // Other status transitions happen through payment recording
  }

  // ── Invoices ──

  async createInvoice(
    _chargeId: string,
    data: CreateInvoiceInput
  ): Promise<ERPInvoice> {
    const body = {
      customer_id: data.customerErpId,
      service_value: data.amountCents / 100,
      description: data.description,
      service_code: data.serviceCode || undefined,
    };
    const invoice = await this.client.post<ContaAzulServiceInvoice>(
      "/services/invoices",
      body
    );
    return this.mapInvoice(invoice);
  }

  async getInvoice(erpId: string): Promise<ERPInvoice | null> {
    try {
      const invoice = await this.client.get<ContaAzulServiceInvoice>(
        `/services/invoices/${erpId}`
      );
      return this.mapInvoice(invoice);
    } catch {
      return null;
    }
  }

  // ── Mappers (private) ──

  private mapCustomer(c: ContaAzulCustomer): ERPCustomer {
    return {
      erpId: c.id,
      name: c.name || c.company_name || "",
      doc: c.document || "",
      email: c.email || "",
      phone: c.mobile_phone || c.business_phone || "",
      razaoSocial: c.company_name || undefined,
      cidade: c.address?.city?.name || undefined,
      estado: c.address?.state?.abbreviation || undefined,
    };
  }

  private mapCharge(r: ContaAzulReceivable): ERPCharge {
    return {
      erpId: r.id,
      customerErpId: r.customer_id,
      description: r.description || r.document_number || "",
      amountCents: Math.round((r.value || 0) * 100),
      amountPaidCents: Math.round((r.paid_value || 0) * 100),
      dueDate: new Date(r.due_date),
      paidAt: r.payment_date ? new Date(r.payment_date) : undefined,
      status: mapContaAzulStatus(r.status),
      statusRaw: r.status,
    };
  }

  private mapInvoice(i: ContaAzulServiceInvoice): ERPInvoice {
    const statusMap: Record<string, ERPInvoice["status"]> = {
      ISSUED: "EMITIDA",
      CANCELLED: "CANCELADA",
      CANCELED: "CANCELADA",
      PENDING: "PENDENTE",
      ERROR: "PENDENTE",
    };
    return {
      erpId: i.protocol_id || i.id,
      number: i.number || "",
      status: statusMap[i.status?.toUpperCase()] || "PENDENTE",
      pdfUrl: i.pdf_url || undefined,
      issuedAt: i.issue_date ? new Date(i.issue_date) : undefined,
    };
  }
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/integrations/conta-azul/adapter.ts
git commit -m "feat(conta-azul): add ContaAzulAdapter implementing ERPAdapter"
```

---

### Task 7: OmieAdapter

**Files:**
- Create: `lib/integrations/omie/adapter.ts`

**Context:** Wraps existing Omie functions (`syncOmieCustomers`, `syncOmieTitles`, `processOmieWebhook`, `omieRequest`, etc.) into the ERPAdapter interface. The existing functions read credentials from env vars — we maintain this for backward compatibility. The adapter reuses `client.ts` functions directly. Reference: `lib/integrations/omie/client.ts` (lines 1-108), `lib/integrations/omie/types.ts`, `lib/integrations/omie/statusMapper.ts`.

- [ ] **Step 1: Create the OmieAdapter**

Create `lib/integrations/omie/adapter.ts`:

```typescript
import type { ERPConfig } from "@prisma/client";
import type { ChargeStatus } from "@prisma/client";
import type {
  ERPAdapter,
  ERPCustomer,
  ERPCharge,
  ERPInvoice,
  ERPWebhookEvent,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateChargeInput,
  CreateInvoiceInput,
} from "../types";
import {
  omieRequest,
  omieRequestAllPages,
  fetchOmieCliente,
  fetchOmieTitulo,
} from "./client";
import { mapOmieStatus } from "./statusMapper";
import type { OmieCliente, OmieContaReceber, OmieWebhookPayload } from "./types";

// ---------------------------------------------------------------------------
// OmieAdapter — wraps existing Omie integration into ERPAdapter interface
// NOTE: Currently reads credentials from env vars for backward compatibility.
// The ERPConfig credentials are available but not yet used by the underlying client.
// ---------------------------------------------------------------------------

export class OmieAdapter implements ERPAdapter {
  readonly provider = "OMIE" as const;

  constructor(private config: ERPConfig) {
    // Config available for future multi-tenant Omie support
  }

  async authenticate(): Promise<void> {
    // Omie uses API key/secret in request body — validated on each call
    // Just verify credentials are available
    if (!process.env.OMIE_APP_KEY || !process.env.OMIE_APP_SECRET) {
      throw new Error("[OmieAdapter] OMIE_APP_KEY and OMIE_APP_SECRET must be set");
    }
  }

  // ── Customers ──

  async listCustomers(_since?: Date): Promise<ERPCustomer[]> {
    const clientes = await omieRequestAllPages<OmieCliente>(
      "/geral/clientes/",
      "ListarClientes",
      "clientes_cadastro",
      { clientesFiltro: { inativo: "N" } }
    );
    return clientes
      .filter((c) => c.codigo_cliente_integracao !== "_CLIENTE_CONSUMIDOR_")
      .map(this.mapCustomer);
  }

  async getCustomer(erpId: string): Promise<ERPCustomer | null> {
    try {
      const cli = await fetchOmieCliente(Number(erpId));
      return this.mapCustomer(cli);
    } catch {
      return null;
    }
  }

  async createCustomer(data: CreateCustomerInput): Promise<ERPCustomer> {
    const result = await omieRequest<{ codigo_cliente_omie: number }>(
      "/geral/clientes/",
      "IncluirCliente",
      {
        razao_social: data.razaoSocial || data.name,
        nome_fantasia: data.name,
        cnpj_cpf: data.doc,
        email: data.email,
        telefone1_numero: data.phone,
        cidade: data.cidade || "",
        estado: data.estado || "",
      }
    );
    const cli = await fetchOmieCliente(result.codigo_cliente_omie);
    return this.mapCustomer(cli);
  }

  async updateCustomer(
    erpId: string,
    data: UpdateCustomerInput
  ): Promise<ERPCustomer> {
    const params: Record<string, unknown> = {
      codigo_cliente_omie: Number(erpId),
    };
    if (data.name) params.nome_fantasia = data.name;
    if (data.razaoSocial) params.razao_social = data.razaoSocial;
    if (data.email) params.email = data.email;
    if (data.phone) params.telefone1_numero = data.phone;

    await omieRequest("/geral/clientes/", "AlterarCliente", params);
    const cli = await fetchOmieCliente(Number(erpId));
    return this.mapCustomer(cli);
  }

  // ── Charges ──

  async listCharges(_since?: Date): Promise<ERPCharge[]> {
    const titulos = await omieRequestAllPages<OmieContaReceber>(
      "/financas/contareceber/",
      "ListarContasReceber",
      "conta_receber_cadastro"
    );
    return titulos.map(this.mapCharge);
  }

  async getCharge(erpId: string): Promise<ERPCharge | null> {
    try {
      const titulo = await fetchOmieTitulo(Number(erpId));
      return this.mapCharge(titulo);
    } catch {
      return null;
    }
  }

  async createCharge(data: CreateChargeInput): Promise<ERPCharge> {
    const dueStr = `${data.dueDate.getDate().toString().padStart(2, "0")}/${(data.dueDate.getMonth() + 1).toString().padStart(2, "0")}/${data.dueDate.getFullYear()}`;
    const result = await omieRequest<{ codigo_lancamento_omie: number }>(
      "/financas/contareceber/",
      "IncluirContaReceber",
      {
        codigo_cliente_fornecedor: Number(data.customerErpId),
        data_vencimento: dueStr,
        valor_documento: data.amountCents / 100,
        numero_documento: data.description,
      }
    );
    const titulo = await fetchOmieTitulo(result.codigo_lancamento_omie);
    return this.mapCharge(titulo);
  }

  async updateChargeStatus(_erpId: string, _status: ChargeStatus): Promise<void> {
    // Omie status is managed internally — no direct status update API
    console.warn("[OmieAdapter] updateChargeStatus not supported by Omie API");
  }

  // ── Invoices ──

  async createInvoice(
    _chargeId: string,
    _data: CreateInvoiceInput
  ): Promise<ERPInvoice> {
    // TODO: Implement via Omie NFS-e API when needed
    throw new Error("[OmieAdapter] createInvoice not yet implemented");
  }

  async getInvoice(_erpId: string): Promise<ERPInvoice | null> {
    // TODO: Implement via Omie NFS-e API when needed
    return null;
  }

  // ── Webhook ──

  parseWebhook(payload: unknown): ERPWebhookEvent {
    const p = payload as OmieWebhookPayload;
    const topicLower = (p.topic || "").toLowerCase();

    if (topicLower.startsWith("financas.contareceber")) {
      return {
        type: "charge",
        action: "updated",
        erpId: String(p.event?.codigo_lancamento_omie || ""),
        payload: p.event as Record<string, unknown>,
      };
    }

    return {
      type: "customer",
      action: "updated",
      erpId: String(p.event?.codigo_cliente_omie || ""),
      payload: p.event as Record<string, unknown>,
    };
  }

  // ── Private mappers ──

  private mapCustomer(cli: OmieCliente): ERPCustomer {
    return {
      erpId: String(cli.codigo_cliente_omie),
      name: cli.nome_fantasia || cli.razao_social || "",
      doc: (cli.cnpj_cpf || "").replace(/\D/g, ""),
      email: cli.email || "",
      phone: cli.telefone1_numero || "",
      razaoSocial: cli.razao_social || undefined,
      cidade: cli.cidade || undefined,
      estado: cli.estado || undefined,
    };
  }

  private mapCharge(titulo: OmieContaReceber): ERPCharge {
    const parseDate = (s?: string) => {
      if (!s) return undefined;
      const [d, m, y] = s.split("/");
      const date = new Date(`${y}-${m}-${d}`);
      return isNaN(date.getTime()) ? undefined : date;
    };

    return {
      erpId: String(titulo.codigo_lancamento_omie),
      customerErpId: String(titulo.codigo_cliente_fornecedor),
      description: titulo.numero_documento || `Omie #${titulo.codigo_lancamento_omie}`,
      amountCents: Math.round((titulo.valor_documento || 0) * 100),
      amountPaidCents: Math.round((titulo.valor_pagamento || 0) * 100),
      dueDate: parseDate(titulo.data_vencimento) || new Date(),
      paidAt: parseDate(titulo.data_pagamento),
      status: mapOmieStatus(titulo.status_titulo || ""),
      statusRaw: titulo.status_titulo || "",
    };
  }
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/integrations/omie/adapter.ts
git commit -m "feat(omie): add OmieAdapter wrapping existing integration into ERPAdapter"
```

---

### Task 8: ERP Factory

**Files:**
- Create: `lib/integrations/erp-factory.ts`

**Context:** The factory looks up ERPConfig for a given franqueadora and returns the correct adapter. It's the single entry point for all ERP interactions. Reference: ERPConfig model has `provider` field and `franqueadoraId` unique constraint.

- [ ] **Step 1: Create the factory**

Create `lib/integrations/erp-factory.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import type { ERPConfig } from "@prisma/client";
import type { ERPAdapter } from "./types";
import { ContaAzulAdapter } from "./conta-azul/adapter";
import { OmieAdapter } from "./omie/adapter";

// ---------------------------------------------------------------------------
// ERP Factory — returns the correct adapter for a franqueadora
// ---------------------------------------------------------------------------

export async function getERPAdapter(
  franqueadoraId: string
): Promise<ERPAdapter> {
  const config = await getERPConfig(franqueadoraId);

  switch (config.provider) {
    case "CONTA_AZUL":
      return new ContaAzulAdapter(config);
    case "OMIE":
      return new OmieAdapter(config);
    case "NONE":
      throw new Error(
        `[ERP Factory] Franqueadora ${franqueadoraId} has no ERP configured`
      );
    default:
      throw new Error(
        `[ERP Factory] Unknown ERP provider: ${config.provider}`
      );
  }
}

export async function getERPConfig(
  franqueadoraId: string
): Promise<ERPConfig> {
  const config = await prisma.eRPConfig.findUnique({
    where: { franqueadoraId },
  });

  if (!config) {
    throw new Error(
      `[ERP Factory] No ERPConfig found for franqueadora ${franqueadoraId}`
    );
  }

  return config;
}

/**
 * Get all franqueadoras with sync enabled and a configured ERP provider.
 */
export async function getSyncableFranqueadoras(): Promise<ERPConfig[]> {
  return prisma.eRPConfig.findMany({
    where: {
      syncEnabled: true,
      provider: { not: "NONE" },
    },
  });
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/integrations/erp-factory.ts
git commit -m "feat(erp): add ERP factory for adapter instantiation"
```

---

## Chunk 3: Sync Engine, Events, and OAuth

### Task 9: New Inngest Event Types

**Files:**
- Modify: `inngest/events.ts`

**Context:** We need 3 new events. The Events map (line 175) defines all event types. Follow the same pattern as existing events. New events: `charge/invoice-requested`, `charge/invoice-issued`, `integration/erp-sync-completed`.

- [ ] **Step 1: Add new event type definitions**

In `inngest/events.ts`, add these type definitions before the `Events` map (before line 174):

```typescript
// --- ERP Integration Events ---
type ChargeInvoiceRequestedEvent = {
  data: {
    chargeId: string;
    franqueadoraId: string;
    customerId: string;
  };
};

type ChargeInvoiceIssuedEvent = {
  data: {
    chargeId: string;
    invoiceNumber: string;
    invoicePdfUrl?: string;
    franqueadoraId: string;
  };
};

type ERPSyncCompletedEvent = {
  data: {
    franqueadoraId: string;
    provider: string;
    customersCreated: number;
    customersUpdated: number;
    chargesCreated: number;
    chargesUpdated: number;
    errors: number;
  };
};
```

- [ ] **Step 2: Add events to the Events map**

In the `Events` type (around line 203, before the closing `}`), add:

```typescript
  "charge/invoice-requested": ChargeInvoiceRequestedEvent;
  "charge/invoice-issued": ChargeInvoiceIssuedEvent;
  "integration/erp-sync-completed": ERPSyncCompletedEvent;
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add inngest/events.ts
git commit -m "feat(erp): add invoice and sync events to Inngest event types"
```

---

### Task 10: Sync Engine

**Files:**
- Create: `lib/integrations/sync-engine.ts`

**Context:** The sync engine is the core logic that pulls data from ERP → Menlo DB using the ERPAdapter interface. It handles customer and charge upserts based on `erpProvider` + `erpCustomerId`/`erpChargeId`. It uses last-write-wins timestamps. Reference the existing `syncOmieCustomers` (lines 9-101 in `lib/integrations/omie/syncCustomers.ts`) for patterns.

- [ ] **Step 1: Create the sync engine**

Create `lib/integrations/sync-engine.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import type { ERPProvider } from "@prisma/client";
import type { ERPAdapter, ERPCustomer, ERPCharge, SyncResult } from "./types";
import { getERPConfig } from "./erp-factory";

// ---------------------------------------------------------------------------
// Generic ERP sync engine — pulls data from ERP and upserts into local DB
// Uses the ERPAdapter interface so it works with any ERP.
// ---------------------------------------------------------------------------

export async function syncFranqueadora(
  franqueadoraId: string,
  adapter: ERPAdapter
): Promise<SyncResult> {
  const config = await getERPConfig(franqueadoraId);
  const since = config.lastSyncAt || undefined;
  const provider = adapter.provider;

  const result: SyncResult = {
    customersCreated: 0,
    customersUpdated: 0,
    customersErrors: 0,
    chargesCreated: 0,
    chargesUpdated: 0,
    chargesErrors: 0,
    errorDetails: [],
  };

  // ── 1. Sync customers ──
  console.log(`[Sync Engine] Syncing customers for ${franqueadoraId} (${provider}) since ${since?.toISOString() || "beginning"}`);

  let erpCustomers: ERPCustomer[] = [];
  try {
    erpCustomers = await adapter.listCustomers(since);
  } catch (err) {
    const msg = `Failed to list customers: ${err instanceof Error ? err.message : String(err)}`;
    result.errorDetails.push(msg);
    console.error(`[Sync Engine] ${msg}`);
  }

  for (const erpCustomer of erpCustomers) {
    try {
      await upsertCustomer(franqueadoraId, provider, erpCustomer, result);
    } catch (err) {
      result.customersErrors++;
      const msg = `Customer ${erpCustomer.erpId}: ${err instanceof Error ? err.message : String(err)}`;
      result.errorDetails.push(msg);
      console.error(`[Sync Engine] ${msg}`);
    }
  }

  // ── 2. Sync charges ──
  console.log(`[Sync Engine] Syncing charges for ${franqueadoraId} (${provider})`);

  let erpCharges: ERPCharge[] = [];
  try {
    erpCharges = await adapter.listCharges(since);
  } catch (err) {
    const msg = `Failed to list charges: ${err instanceof Error ? err.message : String(err)}`;
    result.errorDetails.push(msg);
    console.error(`[Sync Engine] ${msg}`);
  }

  for (const erpCharge of erpCharges) {
    try {
      await upsertCharge(franqueadoraId, provider, erpCharge, result);
    } catch (err) {
      result.chargesErrors++;
      const msg = `Charge ${erpCharge.erpId}: ${err instanceof Error ? err.message : String(err)}`;
      result.errorDetails.push(msg);
      console.error(`[Sync Engine] ${msg}`);
    }
  }

  // ── 3. Update lastSyncAt ──
  await prisma.eRPConfig.update({
    where: { franqueadoraId },
    data: { lastSyncAt: new Date() },
  });

  console.log(
    `[Sync Engine] Done (${provider}): customers ${result.customersCreated}c/${result.customersUpdated}u/${result.customersErrors}e, charges ${result.chargesCreated}c/${result.chargesUpdated}u/${result.chargesErrors}e`
  );

  return result;
}

// ---------------------------------------------------------------------------
// Customer upsert
// ---------------------------------------------------------------------------

async function upsertCustomer(
  franqueadoraId: string,
  provider: ERPProvider,
  erp: ERPCustomer,
  result: SyncResult
): Promise<void> {
  // Look up by generic erpProvider + erpCustomerId
  let existing = await prisma.customer.findFirst({
    where: { erpProvider: provider, erpCustomerId: erp.erpId, franqueadoraId },
  });

  // Fallback: look up by doc within tenant
  if (!existing && erp.doc) {
    existing = await prisma.customer.findFirst({
      where: { doc: erp.doc, franqueadoraId },
    });
  }

  const now = new Date();
  const data = {
    name: erp.name || existing?.name || "Sem nome",
    doc: erp.doc || existing?.doc || "",
    email: erp.email || existing?.email || "",
    phone: erp.phone || existing?.phone || "",
    razaoSocial: erp.razaoSocial || existing?.razaoSocial || null,
    cidade: erp.cidade || existing?.cidade || null,
    estado: erp.estado || existing?.estado || null,
    erpProvider: provider,
    erpCustomerId: erp.erpId,
    erpLastSyncAt: now,
  };

  if (existing) {
    // Last-write-wins: only update if ERP data is newer
    if (existing.updatedAt && existing.erpLastSyncAt && existing.updatedAt > existing.erpLastSyncAt) {
      // Local is newer — skip ERP update (will be pushed in reverse direction)
      return;
    }
    await prisma.customer.update({
      where: { id: existing.id },
      data,
    });
    result.customersUpdated++;
  } else {
    await prisma.customer.create({
      data: { ...data, franqueadoraId },
    });
    result.customersCreated++;
  }
}

// ---------------------------------------------------------------------------
// Charge upsert
// ---------------------------------------------------------------------------

async function upsertCharge(
  franqueadoraId: string,
  provider: ERPProvider,
  erp: ERPCharge,
  result: SyncResult
): Promise<void> {
  // Look up by generic erpProvider + erpChargeId
  let existing = await prisma.charge.findFirst({
    where: { erpProvider: provider, erpChargeId: erp.erpId },
  });

  // Find the local customer by erpCustomerId
  const customer = await prisma.customer.findFirst({
    where: { erpProvider: provider, erpCustomerId: erp.customerErpId, franqueadoraId },
  });

  if (!customer) {
    // Customer not synced yet — skip this charge
    return;
  }

  const now = new Date();
  const data = {
    customerId: customer.id,
    description: erp.description,
    amountCents: erp.amountCents,
    amountPaidCents: erp.amountPaidCents,
    dueDate: erp.dueDate,
    status: erp.status,
    paidAt: erp.status === "PAID" ? (erp.paidAt || existing?.paidAt || now) : null,
    formaPagamento: erp.formaPagamento || existing?.formaPagamento || null,
    erpProvider: provider,
    erpChargeId: erp.erpId,
    erpLastSyncAt: now,
    invoiceNumber: erp.invoiceNumber || existing?.invoiceNumber || null,
    invoicePdfUrl: erp.invoiceUrl || existing?.invoicePdfUrl || null,
  };

  if (existing) {
    // Last-write-wins check
    if (existing.updatedAt && existing.erpLastSyncAt && existing.updatedAt > existing.erpLastSyncAt) {
      return;
    }
    await prisma.charge.update({
      where: { id: existing.id },
      data,
    });
    result.chargesUpdated++;
  } else {
    await prisma.charge.create({ data });
    result.chargesCreated++;
  }
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/integrations/sync-engine.ts
git commit -m "feat(erp): add generic sync engine with customer/charge upsert"
```

---

### Task 11: OAuth2 Routes for Conta Azul

**Files:**
- Create: `app/api/integrations/conta-azul/authorize/route.ts`
- Create: `app/api/integrations/conta-azul/callback/route.ts`

**Context:** OAuth2 Authorization Code flow. Middleware already excludes `/api/integrations/*` from auth (see `middleware.ts` line 18 matcher). The authorize route redirects to Conta Azul; the callback exchanges code for tokens and saves them to ERPConfig. Environment variables needed: `CONTA_AZUL_CLIENT_ID`, `CONTA_AZUL_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`.

- [ ] **Step 1: Create the authorize route**

Create `app/api/integrations/conta-azul/authorize/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/auth-helpers";
import { AUTHORIZE_URL } from "@/lib/integrations/conta-azul/client";

// GET /api/integrations/conta-azul/authorize
// Redirects admin to Conta Azul OAuth authorization page
export async function GET(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  const clientId = process.env.CONTA_AZUL_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "CONTA_AZUL_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/integrations/conta-azul/callback`;
  const scope = "sales receivables customers services";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    state: tenantId!,
  });

  return NextResponse.redirect(`${AUTHORIZE_URL}?${params.toString()}`);
}
```

- [ ] **Step 2: Create the callback route**

Create `app/api/integrations/conta-azul/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens } from "@/lib/integrations/conta-azul/client";

// GET /api/integrations/conta-azul/callback
// Receives OAuth code, exchanges for tokens, saves to ERPConfig
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state"); // franqueadoraId
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) {
    const desc = req.nextUrl.searchParams.get("error_description") || errorParam;
    console.error("[Conta Azul Callback] OAuth error:", desc);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings?error=conta_azul_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state parameter" },
      { status: 400 }
    );
  }

  const clientId = process.env.CONTA_AZUL_CLIENT_ID;
  const clientSecret = process.env.CONTA_AZUL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Conta Azul credentials not configured" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/integrations/conta-azul/callback`;

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      redirectUri,
      clientId,
      clientSecret
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert ERPConfig for this franqueadora
    await prisma.eRPConfig.upsert({
      where: { franqueadoraId: state },
      create: {
        franqueadoraId: state,
        provider: "CONTA_AZUL",
        contaAzulClientId: clientId,
        contaAzulClientSecret: clientSecret,
        contaAzulAccessToken: tokens.access_token,
        contaAzulRefreshToken: tokens.refresh_token,
        contaAzulTokenExpiresAt: expiresAt,
        syncEnabled: true,
      },
      update: {
        provider: "CONTA_AZUL",
        contaAzulClientId: clientId,
        contaAzulClientSecret: clientSecret,
        contaAzulAccessToken: tokens.access_token,
        contaAzulRefreshToken: tokens.refresh_token,
        contaAzulTokenExpiresAt: expiresAt,
        syncEnabled: true,
      },
    });

    console.log(`[Conta Azul Callback] Tokens saved for franqueadora ${state}`);

    return NextResponse.redirect(
      `${appUrl}/settings?success=conta_azul_connected`
    );
  } catch (err) {
    console.error("[Conta Azul Callback] Token exchange failed:", err);
    return NextResponse.redirect(
      `${appUrl}/settings?error=conta_azul_token_failed`
    );
  }
}
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/integrations/conta-azul/authorize/route.ts app/api/integrations/conta-azul/callback/route.ts
git commit -m "feat(conta-azul): add OAuth2 authorize and callback routes"
```

---

### Task 12: ERP Poll Sync (Inngest Cron)

**Files:**
- Create: `inngest/scheduled/erp-poll-sync.ts`

**Context:** Runs every 10 minutes. Iterates over all franqueadoras with sync enabled, calls sync engine for each. Follow the pattern from `inngest/scheduled/check-pending-charges.ts` (cursor-based, onFailure, concurrency). Each franqueadora sync is a separate step.run to benefit from Inngest's step durability.

- [ ] **Step 1: Create the poll sync function**

Create `inngest/scheduled/erp-poll-sync.ts`:

```typescript
import { inngest } from "../client";
import { getSyncableFranqueadoras, getERPAdapter } from "@/lib/integrations/erp-factory";
import { syncFranqueadora } from "@/lib/integrations/sync-engine";

export const erpPollSync = inngest.createFunction(
  {
    id: "erp-poll-sync",
    retries: 3,
    concurrency: [{ key: "erp-poll-sync-global", limit: 1 }],
    onFailure: async ({ error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      const customer = await p.customer.findFirst();
      if (systemUser && customer) {
        await p.collectionTask.create({
          data: {
            title: "[FALHA ERP] Poll sync falhou",
            description: `Erro: ${error.message}`,
            priority: "ALTA",
            status: "PENDENTE",
            customerId: customer.id,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  { cron: "*/10 * * * *" },
  async ({ step }) => {
    // Step 1: Get all syncable franqueadoras
    const configs = await step.run("get-syncable-configs", async () => {
      const cfgs = await getSyncableFranqueadoras();
      return cfgs.map((c) => ({
        id: c.id,
        franqueadoraId: c.franqueadoraId,
        provider: c.provider,
      }));
    });

    if (configs.length === 0) {
      return { synced: 0 };
    }

    // Step 2: Sync each franqueadora in a separate step
    const results: Record<string, unknown> = {};
    for (const config of configs) {
      const syncResult = await step.run(
        `sync-${config.franqueadoraId}`,
        async () => {
          const adapter = await getERPAdapter(config.franqueadoraId);
          return syncFranqueadora(config.franqueadoraId, adapter);
        }
      );
      results[config.franqueadoraId] = syncResult;

      // Emit sync completed event
      await step.sendEvent(`emit-sync-completed-${config.franqueadoraId}`, {
        name: "integration/erp-sync-completed",
        data: {
          franqueadoraId: config.franqueadoraId,
          provider: config.provider,
          customersCreated: syncResult.customersCreated,
          customersUpdated: syncResult.customersUpdated,
          chargesCreated: syncResult.chargesCreated,
          chargesUpdated: syncResult.chargesUpdated,
          errors: syncResult.customersErrors + syncResult.chargesErrors,
        },
      });
    }

    return { synced: configs.length, results };
  }
);
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add inngest/scheduled/erp-poll-sync.ts
git commit -m "feat(erp): add poll sync cron function (every 10 min)"
```

---

## Chunk 4: Push Sync, Invoice, Registration, and Migration

### Task 13: ERP Push Sync (Inngest Reactive)

**Files:**
- Create: `inngest/functions/erp-push-sync.ts`

**Context:** When a customer or charge is created/updated in Menlo, push to ERP. Triggers on `charge/created`, `charge/updated`, `customer/created`, `customer/updated`. Must check if the franqueadora has an ERP configured before pushing. Follow concurrency patterns from other functions.

- [ ] **Step 1: Create the push sync function**

Create `inngest/functions/erp-push-sync.ts`:

```typescript
import { inngest } from "../client";
import { getERPAdapter, getERPConfig } from "@/lib/integrations/erp-factory";

export const erpPushSync = inngest.createFunction(
  {
    id: "erp-push-sync",
    retries: 3,
    concurrency: [
      {
        key: "event.data.chargeId ?? event.data.customerId",
        limit: 1,
      },
    ],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      const customerId =
        data.customerId ||
        (data.chargeId
          ? (await p.charge.findUnique({ where: { id: data.chargeId }, select: { customerId: true } }))?.customerId
          : null);
      if (systemUser && customerId) {
        await p.collectionTask.create({
          data: {
            title: `[FALHA ERP] Push sync falhou: ${event.data.event.name}`,
            description: `Erro: ${error.message}`,
            priority: "ALTA",
            status: "PENDENTE",
            customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  [
    { event: "charge/created" },
    { event: "charge/updated" },
    { event: "customer/created" },
    { event: "customer/updated" },
  ],
  async ({ event, step }) => {
    const { franqueadoraId } = event.data;

    // Step 1: Check if franqueadora has ERP configured
    const config = await step.run("check-erp-config", async () => {
      try {
        const cfg = await getERPConfig(franqueadoraId);
        return { hasERP: cfg.provider !== "NONE", provider: cfg.provider };
      } catch {
        return { hasERP: false, provider: "NONE" };
      }
    });

    if (!config.hasERP) {
      return { skipped: true, reason: "No ERP configured" };
    }

    const { prisma } = await import("@/lib/prisma");

    // Step 2: Push the entity to ERP
    if (event.name === "customer/created" || event.name === "customer/updated") {
      return await step.run("push-customer", async () => {
        const customer = await prisma.customer.findUnique({
          where: { id: event.data.customerId },
        });
        if (!customer) return { skipped: true, reason: "Customer not found" };

        // Skip if already synced recently (avoid loops)
        if (customer.erpLastSyncAt) {
          const timeSinceSync = Date.now() - customer.erpLastSyncAt.getTime();
          if (timeSinceSync < 60_000) {
            return { skipped: true, reason: "Recently synced" };
          }
        }

        // Skip if customer already has an erpCustomerId (came from ERP)
        if (customer.erpCustomerId && event.name === "customer/created") {
          return { skipped: true, reason: "Already linked to ERP" };
        }

        const adapter = await getERPAdapter(franqueadoraId);

        if (customer.erpCustomerId) {
          // Update existing customer in ERP
          await adapter.updateCustomer(customer.erpCustomerId, {
            name: customer.name,
            doc: customer.doc,
            email: customer.email,
            phone: customer.phone,
            razaoSocial: customer.razaoSocial || undefined,
          });
        } else {
          // Create new customer in ERP
          const erpCustomer = await adapter.createCustomer({
            name: customer.name,
            doc: customer.doc,
            email: customer.email,
            phone: customer.phone,
            razaoSocial: customer.razaoSocial || undefined,
            cidade: customer.cidade || undefined,
            estado: customer.estado || undefined,
          });

          // Link back
          await prisma.customer.update({
            where: { id: customer.id },
            data: {
              erpProvider: adapter.provider,
              erpCustomerId: erpCustomer.erpId,
              erpLastSyncAt: new Date(),
            },
          });
        }

        return { pushed: true, entity: "customer", id: customer.id };
      });
    }

    if (event.name === "charge/created" || event.name === "charge/updated") {
      const chargeId = (event.data as { chargeId?: string }).chargeId;
      if (!chargeId) return { skipped: true, reason: "No chargeId" };

      return await step.run("push-charge", async () => {
        const charge = await prisma.charge.findUnique({
          where: { id: chargeId },
          include: { customer: true },
        });
        if (!charge) return { skipped: true, reason: "Charge not found" };

        // Skip if already synced recently (avoid loops)
        if (charge.erpLastSyncAt) {
          const timeSinceSync = Date.now() - charge.erpLastSyncAt.getTime();
          if (timeSinceSync < 60_000) {
            return { skipped: true, reason: "Recently synced" };
          }
        }

        // Skip if charge already has an erpChargeId (came from ERP)
        if (charge.erpChargeId && event.name === "charge/created") {
          return { skipped: true, reason: "Already linked to ERP" };
        }

        const adapter = await getERPAdapter(franqueadoraId);

        if (charge.erpChargeId) {
          // Update status in ERP
          await adapter.updateChargeStatus(charge.erpChargeId, charge.status);
        } else {
          // Need customer's erpCustomerId to create charge in ERP
          if (!charge.customer.erpCustomerId) {
            return { skipped: true, reason: "Customer not linked to ERP" };
          }

          const erpCharge = await adapter.createCharge({
            customerErpId: charge.customer.erpCustomerId,
            description: charge.description,
            amountCents: charge.amountCents,
            dueDate: charge.dueDate,
            formaPagamento: charge.formaPagamento || undefined,
          });

          // Link back
          await prisma.charge.update({
            where: { id: charge.id },
            data: {
              erpProvider: adapter.provider,
              erpChargeId: erpCharge.erpId,
              erpLastSyncAt: new Date(),
            },
          });
        }

        return { pushed: true, entity: "charge", id: chargeId };
      });
    }

    return { skipped: true, reason: "Unhandled event" };
  }
);
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add inngest/functions/erp-push-sync.ts
git commit -m "feat(erp): add push sync reactive function (Menlo → ERP)"
```

---

### Task 14: ERP Create Invoice (Inngest Reactive)

**Files:**
- Create: `inngest/functions/erp-create-invoice.ts`

**Context:** Triggered by `charge/invoice-requested`. Calls adapter.createInvoice(), then polls for async completion (Conta Azul returns 202 with protocolId). Max 5 retries with backoff. On success, updates Charge with invoice data and emits `charge/invoice-issued`.

- [ ] **Step 1: Create the invoice function**

Create `inngest/functions/erp-create-invoice.ts`:

```typescript
import { inngest } from "../client";
import { getERPAdapter } from "@/lib/integrations/erp-factory";

const MAX_STATUS_CHECKS = 5;

export const erpCreateInvoice = inngest.createFunction(
  {
    id: "erp-create-invoice",
    retries: 5,
    concurrency: [{ key: "event.data.chargeId", limit: 1 }],
    onFailure: async ({ event, error }) => {
      const { prisma: p } = await import("@/lib/prisma");
      const data = event.data.event.data;
      const systemUser = await p.user.findFirst({
        where: { role: "ADMINISTRADOR" },
        select: { id: true },
      });
      if (systemUser) {
        await p.collectionTask.create({
          data: {
            title: `[CRITICA] Emissão de NF falhou: cobrança ${data.chargeId}`,
            description: `Erro: ${error.message}. Franqueadora: ${data.franqueadoraId}`,
            priority: "CRITICA",
            status: "PENDENTE",
            customerId: data.customerId,
            createdById: systemUser.id,
          },
        });
      }
    },
  },
  { event: "charge/invoice-requested" },
  async ({ event, step }) => {
    const { chargeId, franqueadoraId, customerId } = event.data;
    const { prisma } = await import("@/lib/prisma");

    // Step 1: Load charge and customer data
    const charge = await step.run("load-charge", async () => {
      const c = await prisma.charge.findUnique({
        where: { id: chargeId },
        include: { customer: true },
      });
      if (!c) throw new Error(`Charge ${chargeId} not found`);
      return {
        id: c.id,
        description: c.description,
        amountCents: c.amountCents,
        customerErpId: c.customer.erpCustomerId,
        customerId: c.customerId,
      };
    });

    if (!charge.customerErpId) {
      throw new Error(`Customer ${charge.customerId} not linked to ERP`);
    }

    // Step 2: Request invoice creation in ERP
    const invoice = await step.run("request-invoice", async () => {
      const adapter = await getERPAdapter(franqueadoraId);
      return adapter.createInvoice(chargeId, {
        customerErpId: charge.customerErpId!,
        amountCents: charge.amountCents,
        description: charge.description,
      });
    });

    // Step 3: If still PENDENTE, poll for completion (async processing)
    let finalInvoice = invoice;
    if (invoice.status === "PENDENTE" && invoice.erpId) {
      for (let attempt = 0; attempt < MAX_STATUS_CHECKS; attempt++) {
        // Wait with increasing backoff: 30s, 60s, 90s, 120s, 150s
        await step.sleep(
          `wait-invoice-status-${attempt}`,
          `${(attempt + 1) * 30}s`
        );

        const checked = await step.run(
          `check-invoice-status-${attempt}`,
          async () => {
            const adapter = await getERPAdapter(franqueadoraId);
            return adapter.getInvoice(invoice.erpId);
          }
        );

        if (checked && checked.status !== "PENDENTE") {
          finalInvoice = checked;
          break;
        }
      }
    }

    // Step 4: Update charge with invoice data
    await step.run("update-charge", async () => {
      await prisma.charge.update({
        where: { id: chargeId },
        data: {
          invoiceNumber: finalInvoice.number || null,
          invoiceStatus: finalInvoice.status,
          invoicePdfUrl: finalInvoice.pdfUrl || null,
          invoiceIssuedAt: finalInvoice.issuedAt || (finalInvoice.status === "EMITIDA" ? new Date() : null),
          nfEmitida: finalInvoice.status === "EMITIDA",
        },
      });
    });

    // Step 5: Emit invoice-issued event if successful
    if (finalInvoice.status === "EMITIDA") {
      await step.sendEvent("emit-invoice-issued", {
        name: "charge/invoice-issued",
        data: {
          chargeId,
          invoiceNumber: finalInvoice.number,
          invoicePdfUrl: finalInvoice.pdfUrl,
          franqueadoraId,
        },
      });
    }

    return {
      chargeId,
      invoiceNumber: finalInvoice.number,
      status: finalInvoice.status,
    };
  }
);
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add inngest/functions/erp-create-invoice.ts
git commit -m "feat(erp): add invoice creation function with async polling"
```

---

### Task 15: Invoice API Route

**Files:**
- Create: `app/api/charges/[id]/invoice/route.ts`

**Context:** POST endpoint to request invoice emission. Must validate tenant ownership, check charge exists and has ERP link, then emit `charge/invoice-requested` event. Follow the pattern from `app/api/charges/[id]/route.ts`.

- [ ] **Step 1: Create the route**

Create `app/api/charges/[id]/invoice/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";
import { inngest } from "@/inngest";

// POST /api/charges/[id]/invoice
// Request invoice (NF) emission via ERP
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const charge = await prisma.charge.findFirst({
      where: { id: params.id, customer: { franqueadoraId: tenantId! } },
      include: { customer: true },
    });

    if (!charge) {
      return NextResponse.json(
        { error: "Cobrança não encontrada" },
        { status: 404 }
      );
    }

    if (charge.invoiceStatus === "EMITIDA") {
      return NextResponse.json(
        { error: "Nota fiscal já emitida", invoiceNumber: charge.invoiceNumber },
        { status: 409 }
      );
    }

    if (charge.invoiceStatus === "PENDENTE") {
      return NextResponse.json(
        { error: "Emissão de nota fiscal já em andamento" },
        { status: 409 }
      );
    }

    // Update status to PENDENTE immediately
    await prisma.charge.update({
      where: { id: charge.id },
      data: { invoiceStatus: "PENDENTE" },
    });

    // Emit event for async processing
    try {
      await inngest.send({
        name: "charge/invoice-requested",
        data: {
          chargeId: charge.id,
          franqueadoraId: tenantId!,
          customerId: charge.customerId,
        },
      });
    } catch (inngestErr) {
      console.error("[inngest] Failed to emit charge/invoice-requested:", inngestErr);
      // Revert status
      await prisma.charge.update({
        where: { id: charge.id },
        data: { invoiceStatus: null },
      });
      return NextResponse.json(
        { error: "Falha ao iniciar emissão de NF" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Emissão de NF solicitada",
      chargeId: charge.id,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao solicitar emissão de NF" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/api/charges/[id]/invoice/route.ts
git commit -m "feat(erp): add invoice emission API endpoint"
```

---

### Task 16: Register New Functions and Refactor Omie Sync

**Files:**
- Modify: `inngest/index.ts`
- Modify: `inngest/sagas/omie-sync.ts`

**Context:** Register the 3 new Inngest functions. Also update `omie-sync.ts` to populate the generic ERP fields when processing webhooks, so new records from Omie get linked to the generic ERP system.

- [ ] **Step 1: Add imports and register functions in inngest/index.ts**

In `inngest/index.ts`, add imports after the existing scheduled imports (after line 23):

```typescript
import { erpPollSync } from "./scheduled/erp-poll-sync";
```

After the existing function imports (after line 29), add:

```typescript
import { erpPushSync } from "./functions/erp-push-sync";
import { erpCreateInvoice } from "./functions/erp-create-invoice";
```

In the `allFunctions` array, add these 3 entries. After `evaluateVariants,` (line 49) and before `// Sagas`:

```typescript
  erpPollSync,
```

After the reactive functions block (after `captureEngagementFromPayment,` around line 44), add:

```typescript
  erpPushSync,
  erpCreateInvoice,
```

- [ ] **Step 2: Update omie-sync saga to populate generic ERP fields**

In `inngest/sagas/omie-sync.ts`, in the `process-webhook` step result handling (around line 44), update the charge events emission to include a step that sets generic ERP fields. After the `process-webhook` step.run (line 39-41), add a new step before the event emissions:

After line 41 (`});`), add:

```typescript
    // Populate generic ERP fields for traceability
    if (result.chargeId) {
      await step.run("link-erp-fields", async () => {
        const { prisma: p } = await import("@/lib/prisma");
        const charge = await p.charge.findUnique({ where: { id: result.chargeId! } });
        if (charge && !charge.erpProvider) {
          await p.charge.update({
            where: { id: result.chargeId! },
            data: {
              erpProvider: "OMIE",
              erpChargeId: charge.omieCodigoTitulo?.toString() || null,
              erpLastSyncAt: new Date(),
            },
          });
        }
        if (result.customerId) {
          const customer = await p.customer.findUnique({ where: { id: result.customerId } });
          if (customer && !customer.erpProvider) {
            await p.customer.update({
              where: { id: result.customerId },
              data: {
                erpProvider: "OMIE",
                erpCustomerId: customer.omieCodigoCliente?.toString() || null,
                erpLastSyncAt: new Date(),
              },
            });
          }
        }
      });
    }
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add inngest/index.ts inngest/sagas/omie-sync.ts
git commit -m "feat(erp): register new functions and add ERP field linking to omie-sync"
```

---

### Task 17: Data Migration — Populate Generic ERP Fields for Existing Omie Data

**Files:**
- Create: `prisma/migrations/<date>_populate_erp_fields/migration.sql`

**Context:** Existing Omie-linked records have `omieCodigoCliente` and `omieCodigoTitulo` but no `erpProvider`/`erpCustomerId`/`erpChargeId`. This migration fills them. It's a data-only migration (no schema changes).

- [ ] **Step 1: Create the migration directory and SQL**

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d)_populate_erp_fields
```

Create the SQL migration file:

```sql
-- Populate generic ERP fields for existing Omie-linked customers
UPDATE "Customer"
SET "erpProvider" = 'OMIE',
    "erpCustomerId" = "omie_codigo_cliente"::text,
    "erpLastSyncAt" = "omie_last_sync_at"
WHERE "omie_codigo_cliente" IS NOT NULL
  AND "erpProvider" IS NULL;

-- Populate generic ERP fields for existing Omie-linked charges
UPDATE "Charge"
SET "erpProvider" = 'OMIE',
    "erpChargeId" = "omie_codigo_titulo"::text,
    "erpLastSyncAt" = "omie_last_sync_at"
WHERE "omie_codigo_titulo" IS NOT NULL
  AND "erpProvider" IS NULL;
```

- [ ] **Step 2: Verify the migration content is correct**

Run: `cat prisma/migrations/*_populate_erp_fields/migration.sql`
Expected: Shows the UPDATE statements above

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/
git commit -m "feat(erp): add data migration to populate generic ERP fields for existing Omie records"
```

---

### Task 18: Final Verification and Build Check

**Files:** None (verification only)

**Context:** Verify the entire implementation compiles and the build succeeds.

- [ ] **Step 1: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors

- [ ] **Step 3: Build check**

Run: `npx next build`
Expected: Build succeeds (may show warnings but no errors)

- [ ] **Step 4: Verify all files exist**

Verify these files were created:
```
lib/integrations/types.ts
lib/integrations/erp-factory.ts
lib/integrations/sync-engine.ts
lib/integrations/conta-azul/types.ts
lib/integrations/conta-azul/status-mapper.ts
lib/integrations/conta-azul/client.ts
lib/integrations/conta-azul/adapter.ts
lib/integrations/omie/adapter.ts
app/api/integrations/conta-azul/authorize/route.ts
app/api/integrations/conta-azul/callback/route.ts
app/api/charges/[id]/invoice/route.ts
inngest/scheduled/erp-poll-sync.ts
inngest/functions/erp-push-sync.ts
inngest/functions/erp-create-invoice.ts
```

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "feat(erp): complete multi-ERP integration implementation"
```
