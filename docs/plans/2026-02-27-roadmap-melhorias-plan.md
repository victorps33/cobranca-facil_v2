# Roadmap de Melhorias — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tornar o Menlo Cobrança robusto, performático e escalável para produção com múltiplos clientes.

**Architecture:** 4 fases incrementais — Fase 1 (segurança/estabilidade) cria a fundação com rate limiting, error handling, validação Zod e audit logging. Fase 2 (performance) introduz React Query, server-side pagination e índices. Fase 3 (qualidade) adiciona testes e refatora componentes grandes. Fase 4 (polish) migra forms para React Hook Form e state para Zustand.

**Tech Stack:** Next.js 14, React 18, TypeScript, Prisma, PostgreSQL (Supabase), Zod, TanStack Query, Vitest, Zustand

---

## FASE 1: SEGURANÇA & ESTABILIDADE

---

### Task 1: Rate Limiting Middleware

**Files:**
- Create: `lib/rate-limit.ts`
- Modify: `middleware.ts`
- Create: `__tests__/lib/rate-limit.test.ts`

**Step 1: Create rate limiter utility**

```typescript
// lib/rate-limit.ts
import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth: { windowMs: 60_000, max: 10 },
  api: { windowMs: 60_000, max: 100 },
  webhook: { windowMs: 60_000, max: 30 },
};

export function getRateLimitConfig(pathname: string): RateLimitConfig {
  if (pathname.startsWith("/api/auth")) return RATE_LIMITS.auth;
  if (pathname.startsWith("/api/webhooks")) return RATE_LIMITS.webhook;
  return RATE_LIMITS.api;
}

export function checkRateLimit(
  ip: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `${ip}`;
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true };
  }

  if (entry.count >= config.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

export function rateLimitResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Muitas requisições. Tente novamente em breve." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    }
  );
}
```

**Step 2: Integrate into middleware**

Open `middleware.ts` and replace its content:

```typescript
// middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, getRateLimitConfig, rateLimitResponse } from "@/lib/rate-limit";

function applyRateLimit(req: NextRequest): NextResponse | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const config = getRateLimitConfig(req.nextUrl.pathname);
  const result = checkRateLimit(ip, config);

  if (!result.allowed) {
    return rateLimitResponse(result.retryAfter!);
  }
  return null;
}

export default withAuth(
  function middleware(req) {
    const rateLimitResult = applyRateLimit(req);
    if (rateLimitResult) return rateLimitResult;
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        const isPublic =
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/cron") ||
          pathname.startsWith("/api/webhooks") ||
          pathname.startsWith("/api/integrations") ||
          pathname.startsWith("/auth") ||
          pathname.startsWith("/boleto") ||
          pathname.startsWith("/_next") ||
          pathname.startsWith("/favicon") ||
          pathname.includes(".");
        return isPublic || !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

**Step 3: Run the app to verify middleware works**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add lib/rate-limit.ts middleware.ts
git commit -m "feat: add rate limiting middleware for API protection"
```

---

### Task 2: Structured Logger

**Files:**
- Create: `lib/logger.ts`

**Step 1: Create logger utility**

```typescript
// lib/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  route?: string;
  action?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (error instanceof Error) {
    entry.errorName = error.name;
    entry.errorMessage = error.message;
    entry.stack = error.stack;
  } else if (error !== undefined) {
    entry.error = error;
  }

  return JSON.stringify(entry);
}

export function logError(message: string, context?: LogContext, error?: unknown) {
  console.error(formatLog("error", message, context, error));
}

export function logWarn(message: string, context?: LogContext) {
  console.warn(formatLog("warn", message, context));
}

export function logInfo(message: string, context?: LogContext) {
  console.log(formatLog("info", message, context));
}

export function logDebug(message: string, context?: LogContext) {
  if (process.env.NODE_ENV === "development") {
    console.log(formatLog("debug", message, context));
  }
}
```

**Step 2: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add lib/logger.ts
git commit -m "feat: add structured logging utility"
```

---

### Task 3: API Handler Wrapper with Zod Validation

**Files:**
- Create: `lib/api-handler.ts`
- Create: `lib/validation/customers.ts`
- Create: `lib/validation/charges.ts`
- Create: `lib/validation/auth.ts`
- Create: `lib/validation/index.ts`

**Step 1: Create validation schemas**

```typescript
// lib/validation/customers.ts
import { z } from "zod";

export const CreateCustomerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  doc: z.string().min(1, "CPF/CNPJ é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  whatsappPhone: z.string().optional().or(z.literal("")),
  razaoSocial: z.string().optional().or(z.literal("")),
  cidade: z.string().optional().or(z.literal("")),
  estado: z.string().optional().or(z.literal("")),
  bairro: z.string().optional().or(z.literal("")),
  responsavel: z.string().optional().or(z.literal("")),
  statusLoja: z.enum(["Aberta", "Fechada", "Vendida"]).optional(),
  dataAbertura: z.string().optional().or(z.literal("")),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
```

```typescript
// lib/validation/charges.ts
import { z } from "zod";

export const CreateChargeSchema = z.object({
  customerId: z.string().min(1, "Cliente é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amountCents: z.number().int().positive("Valor deve ser positivo"),
  dueDate: z.string().min(1, "Data de vencimento é obrigatória"),
  categoria: z.string().optional(),
  formaPagamento: z.string().optional(),
  competencia: z.string().optional(),
  nfEmitida: z.boolean().optional(),
});

export const UpdateChargeSchema = z.object({
  status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELED", "PARTIAL"]).optional(),
  amountCents: z.number().int().positive().optional(),
  dueDate: z.string().optional(),
  description: z.string().optional(),
  categoria: z.string().optional(),
  formaPagamento: z.string().optional(),
  competencia: z.string().optional(),
  nfEmitida: z.boolean().optional(),
  paidAt: z.string().nullable().optional(),
  valorPago: z.number().int().optional(),
});

export type CreateChargeInput = z.infer<typeof CreateChargeSchema>;
export type UpdateChargeInput = z.infer<typeof UpdateChargeSchema>;
```

```typescript
// lib/validation/auth.ts
import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  name: z.string().min(1, "Nome é obrigatório"),
  empresaNome: z.string().min(1, "Nome da empresa é obrigatório"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
```

```typescript
// lib/validation/index.ts
export * from "./customers";
export * from "./charges";
export * from "./auth";
```

**Step 2: Create API handler wrapper**

```typescript
// lib/api-handler.ts
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { logError } from "@/lib/logger";

interface ApiHandlerOptions {
  route: string;
}

type HandlerFn<TBody> = (
  req: NextRequest,
  body: TBody,
  params?: Record<string, string>
) => Promise<NextResponse>;

export function withValidation<TBody>(
  schema: z.ZodSchema<TBody>,
  handler: HandlerFn<TBody>,
  options: ApiHandlerOptions
) {
  return async (req: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    try {
      const rawBody = await req.json();
      const result = schema.safeParse(rawBody);

      if (!result.success) {
        return NextResponse.json(
          {
            error: "Dados inválidos",
            issues: result.error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          },
          { status: 400 }
        );
      }

      const params = context?.params ? await context.params : undefined;
      return await handler(req, result.data, params);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: "Dados inválidos", issues: error.issues },
          { status: 400 }
        );
      }

      logError("API handler error", { route: options.route }, error);
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      );
    }
  };
}

export function withErrorHandling(
  handler: (req: NextRequest, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse>,
  options: ApiHandlerOptions
) {
  return async (req: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    try {
      return await handler(req, context);
    } catch (error) {
      logError("Unhandled API error", { route: options.route }, error);
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      );
    }
  };
}
```

**Step 3: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add lib/api-handler.ts lib/validation/
git commit -m "feat: add Zod validation schemas and API handler wrapper"
```

---

### Task 4: Refactor Customers API with Validation

**Files:**
- Modify: `app/api/customers/route.ts`

**Step 1: Read the current file**

Read `app/api/customers/route.ts` to understand current implementation.

**Step 2: Refactor GET handler with error handling**

Replace the GET handler's catch block (currently `catch { return NextResponse.json([]) }`) with proper logging:

```typescript
// In app/api/customers/route.ts — update imports at top
import { logError } from "@/lib/logger";
import { withValidation } from "@/lib/api-handler";
import { CreateCustomerSchema } from "@/lib/validation/customers";
```

Replace the GET catch block:
```typescript
// OLD (line ~74):
} catch {
  return NextResponse.json([]);
}

// NEW:
} catch (error) {
  logError("Failed to list customers", { route: "/api/customers", action: "GET", tenantId }, error);
  return NextResponse.json({ error: "Falha ao listar clientes" }, { status: 500 });
}
```

**Step 3: Refactor POST handler with Zod validation**

Replace the POST handler to use Zod:

```typescript
// OLD manual validation (lines ~101-103):
// if (!name || !doc) { return ... }

// NEW: Replace the entire POST export
export const POST = withValidation(
  CreateCustomerSchema,
  async (req, body) => {
    const { error: authError, tenantId } = await requireTenant();
    if (authError) return authError;

    const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO", "OPERACIONAL"]);
    if (roleCheck.error) return roleCheck.error;

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        doc: body.doc,
        email: body.email || null,
        phone: body.phone || null,
        whatsappPhone: body.whatsappPhone || null,
        razaoSocial: body.razaoSocial || null,
        cidade: body.cidade || null,
        estado: body.estado || null,
        bairro: body.bairro || null,
        responsavel: body.responsavel || null,
        statusLoja: body.statusLoja || "Aberta",
        dataAbertura: body.dataAbertura ? new Date(body.dataAbertura) : null,
        franqueadoraId: tenantId,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  },
  { route: "/api/customers" }
);
```

**Step 4: Verify build**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next build`
Expected: Build succeeds

**Step 5: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add app/api/customers/route.ts
git commit -m "refactor: add Zod validation and structured logging to customers API"
```

---

### Task 5: Refactor Charges API with Validation

**Files:**
- Modify: `app/api/charges/route.ts`

**Step 1: Read the current file**

Read `app/api/charges/route.ts` to understand current implementation.

**Step 2: Update imports and GET error handling**

```typescript
// Add to imports
import { logError } from "@/lib/logger";
import { withValidation } from "@/lib/api-handler";
import { CreateChargeSchema } from "@/lib/validation/charges";
```

Replace GET catch block:
```typescript
// OLD:
} catch {
  return NextResponse.json([]);
}

// NEW:
} catch (error) {
  logError("Failed to list charges", { route: "/api/charges", action: "GET", tenantId }, error);
  return NextResponse.json({ error: "Falha ao listar cobranças" }, { status: 500 });
}
```

**Step 3: Refactor POST with Zod validation**

Replace the POST handler similarly to Task 4, using `CreateChargeSchema` and `withValidation`.

**Step 4: Verify build**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next build`
Expected: Build succeeds

**Step 5: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add app/api/charges/route.ts
git commit -m "refactor: add Zod validation and structured logging to charges API"
```

---

### Task 6: Audit Logging

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/audit.ts`

**Step 1: Add AuditLog model to Prisma schema**

Append to `prisma/schema.prisma`:

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String   // CREATE, UPDATE, DELETE
  entity    String   // Customer, Charge, DunningRule, etc.
  entityId  String
  details   Json?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([entity, entityId])
  @@index([createdAt])
}
```

Also add to the User model relations:
```prisma
// In model User, add:
auditLogs AuditLog[]
```

**Step 2: Push schema**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx prisma db push`
Expected: Schema synced successfully

**Step 3: Create audit helper**

```typescript
// lib/audit.ts
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

interface AuditEntry {
  userId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details ?? undefined,
      },
    });
  } catch (error) {
    // Audit logging should never break the main flow
    logError("Failed to write audit log", { action: entry.action, entity: entry.entity }, error);
  }
}
```

**Step 4: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add prisma/schema.prisma lib/audit.ts
git commit -m "feat: add audit logging with AuditLog model and helper"
```

---

### Task 7: Fix Silent Error Catches

**Files:**
- Modify: `components/providers/AppDataProvider.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `components/inbox/InboxShell.tsx`
- Modify: `components/crm/CreateTaskDialog.tsx`
- Modify: `components/crm/CrmDashboard.tsx`
- Modify: `app/(dashboard)/crm/[id]/page.tsx`
- Modify: `components/command-palette/CommandPalette.tsx`
- Modify: `app/(dashboard)/page.tsx`

**Step 1: Create a client-side safe fetch utility**

```typescript
// lib/safe-fetch.ts
"use client";

export async function safeFetch<T>(
  url: string,
  fallback: T,
  options?: RequestInit
): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      console.warn(`[safeFetch] ${url} returned ${res.status}`);
      return fallback;
    }
    return await res.json();
  } catch (error) {
    console.warn(`[safeFetch] ${url} failed:`, error);
    return fallback;
  }
}
```

**Step 2: Update AppDataProvider.tsx**

Read the file, then replace all `.catch(() => [])` and `catch {}` with `safeFetch`:

```typescript
// In components/providers/AppDataProvider.tsx
// Replace imports and add:
import { safeFetch } from "@/lib/safe-fetch";

// Replace the fetch calls (lines ~46-50) from:
//   fetch("/api/crm/tasks").then(r => r.json()).catch(() => []),
//   fetch("/api/charges").then(r => r.json()).catch(() => []),
// To:
const [tasksData, chargesData] = await Promise.all([
  safeFetch("/api/crm/tasks", []),
  safeFetch("/api/charges", []),
]);
```

Apply the same pattern to each of the empty catch blocks in the listed files. For each file:
1. Read the file
2. Find the `.catch(() => {})` or `catch {}` pattern
3. Replace with `safeFetch` or add `console.warn` with context

**Step 3: Verify build**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next build`
Expected: Build succeeds

**Step 4: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add lib/safe-fetch.ts components/providers/AppDataProvider.tsx app/(dashboard)/layout.tsx components/inbox/InboxShell.tsx components/crm/CreateTaskDialog.tsx components/crm/CrmDashboard.tsx "app/(dashboard)/crm/[id]/page.tsx" components/command-palette/CommandPalette.tsx "app/(dashboard)/page.tsx"
git commit -m "fix: replace silent error catches with logged warnings"
```

---

## FASE 2: PERFORMANCE & DATA

---

### Task 8: Install and Configure React Query

**Files:**
- Modify: `package.json`
- Create: `lib/query-client.ts`
- Modify: `app/layout.tsx`

**Step 1: Install TanStack Query**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npm install @tanstack/react-query`

**Step 2: Create query client config**

```typescript
// lib/query-client.ts
"use client";

import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30 seconds
        retry: 2,
        refetchOnWindowFocus: true,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
```

**Step 3: Create provider component**

```typescript
// components/providers/QueryProvider.tsx
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Step 4: Add to root layout**

Read `app/layout.tsx`, then wrap children with QueryProvider (inside SessionProvider):

```typescript
// In app/layout.tsx, add import:
import { QueryProvider } from "@/components/providers/QueryProvider";

// Wrap children:
<SessionProvider>
  <QueryProvider>
    <PreferencesProvider>
      {children}
    </PreferencesProvider>
  </QueryProvider>
</SessionProvider>
```

**Step 5: Verify build**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next build`
Expected: Build succeeds

**Step 6: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add lib/query-client.ts components/providers/QueryProvider.tsx app/layout.tsx package.json package-lock.json
git commit -m "feat: install and configure TanStack Query"
```

---

### Task 9: Migrate Dashboard to React Query

**Files:**
- Modify: `app/(dashboard)/page.tsx`

**Step 1: Read the current file**

Read `app/(dashboard)/page.tsx`.

**Step 2: Replace useEffect+fetch with useQuery**

```typescript
// Replace the manual fetch pattern:
// OLD:
// useEffect(() => {
//   fetch("/api/dashboard").then(r => r.json()).then(setData)...
// }, []);

// NEW:
import { useQuery } from "@tanstack/react-query";

// Inside the component:
const { data, isLoading } = useQuery({
  queryKey: ["dashboard"],
  queryFn: () => fetch("/api/dashboard").then(r => r.json()),
});
```

Replace `loading` state variable with `isLoading` from useQuery. Remove the manual `useEffect` for data fetching.

**Step 3: Verify build**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next build`
Expected: Build succeeds

**Step 4: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add "app/(dashboard)/page.tsx"
git commit -m "refactor: migrate dashboard to React Query"
```

---

### Task 10: Migrate Clientes Page to React Query

**Files:**
- Modify: `app/(dashboard)/clientes/page.tsx`

**Step 1: Read and refactor**

Same pattern as Task 9 — replace `useEffect` + `fetch("/api/customers")` with:

```typescript
const { data: franqueados = [], isLoading: loading } = useQuery({
  queryKey: ["customers"],
  queryFn: () => fetch("/api/customers").then(r => r.json()),
});
```

Remove the manual `useState` for `franqueados` and `loading` that the query replaces.

**Step 2: Verify build and commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add "app/(dashboard)/clientes/page.tsx"
git commit -m "refactor: migrate clientes page to React Query"
```

---

### Task 11: Migrate Cobranças Page to React Query

**Files:**
- Modify: `app/(dashboard)/cobrancas/page.tsx`

Same pattern as Tasks 9-10. Replace `useEffect` + `fetch("/api/charges")` with `useQuery`.

**Commit:**
```bash
git commit -m "refactor: migrate cobranças page to React Query"
```

---

### Task 12: Server-Side Pagination for Customers API

**Files:**
- Modify: `app/api/customers/route.ts`

**Step 1: Read the current file**

**Step 2: Add pagination to GET handler**

```typescript
// In the GET handler, after requireTenant():
const { searchParams } = new URL(req.url);
const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));
const skip = (page - 1) * pageSize;

// Add to Prisma query:
const [customers, total] = await Promise.all([
  prisma.customer.findMany({
    where: { franqueadoraId: tenantId },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
  }),
  prisma.customer.count({
    where: { franqueadoraId: tenantId },
  }),
]);

return NextResponse.json({
  data: customers,
  total,
  page,
  pageSize,
});
```

**Step 3: Update frontend to handle new response format**

In `app/(dashboard)/clientes/page.tsx`, update the query to handle `{ data, total }` response format.

**Step 4: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add app/api/customers/route.ts "app/(dashboard)/clientes/page.tsx"
git commit -m "feat: add server-side pagination to customers API"
```

---

### Task 13: Server-Side Pagination for Charges API

**Files:**
- Modify: `app/api/charges/route.ts`
- Modify: `app/(dashboard)/cobrancas/page.tsx`

Same pattern as Task 12 — add `page`/`pageSize` params, use Prisma `skip`/`take`, return `{ data, total }`.

**Commit:**
```bash
git commit -m "feat: add server-side pagination to charges API"
```

---

### Task 14: Database Indexes

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add composite indexes**

```prisma
// In model Customer, add:
@@index([franqueadoraId, statusLoja])
@@index([franqueadoraId, doc])

// In model Charge, add:
@@index([franqueadoraId, status])
@@index([franqueadoraId, competencia])
@@index([customerId, status])

// In model Conversation, add (if not already present):
@@index([franqueadoraId, status])
@@index([customerId])

// In model NotificationLog, add:
@@index([chargeId, status])
```

**Step 2: Push schema**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx prisma db push`
Expected: Indexes created successfully

**Step 3: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add prisma/schema.prisma
git commit -m "perf: add composite database indexes for common queries"
```

---

## FASE 3: QUALIDADE DE CÓDIGO

---

### Task 15: Setup Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `__tests__/setup.ts`

**Step 1: Install test dependencies**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react`

**Step 2: Create vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.{ts,tsx}"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

**Step 3: Create setup file**

```typescript
// __tests__/setup.ts
import "@testing-library/jest-dom/vitest";
```

**Step 4: Add test script to package.json**

```json
// In package.json scripts, add:
"test": "vitest run",
"test:watch": "vitest"
```

**Step 5: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add vitest.config.ts __tests__/setup.ts package.json package-lock.json
git commit -m "feat: setup Vitest with React Testing Library"
```

---

### Task 16: Tests for Core Utilities

**Files:**
- Create: `__tests__/lib/rate-limit.test.ts`
- Create: `__tests__/lib/audit.test.ts`
- Create: `__tests__/lib/password.test.ts`

**Step 1: Write rate limit tests**

```typescript
// __tests__/lib/rate-limit.test.ts
import { describe, it, expect } from "vitest";
import { checkRateLimit, getRateLimitConfig } from "@/lib/rate-limit";

describe("getRateLimitConfig", () => {
  it("returns auth config for /api/auth paths", () => {
    const config = getRateLimitConfig("/api/auth/login");
    expect(config.max).toBe(10);
  });

  it("returns webhook config for /api/webhooks paths", () => {
    const config = getRateLimitConfig("/api/webhooks/twilio");
    expect(config.max).toBe(30);
  });

  it("returns default API config for other paths", () => {
    const config = getRateLimitConfig("/api/customers");
    expect(config.max).toBe(100);
  });
});

describe("checkRateLimit", () => {
  it("allows first request", () => {
    const result = checkRateLimit("test-ip-1", { windowMs: 60000, max: 5 });
    expect(result.allowed).toBe(true);
  });

  it("blocks after max requests", () => {
    const config = { windowMs: 60000, max: 2 };
    checkRateLimit("test-ip-2", config);
    checkRateLimit("test-ip-2", config);
    const result = checkRateLimit("test-ip-2", config);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
```

**Step 2: Write password tests**

```typescript
// __tests__/lib/password.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashes and verifies correctly", async () => {
    const hash = await hashPassword("mypassword123");
    expect(hash).not.toBe("mypassword123");
    const valid = await verifyPassword("mypassword123", hash);
    expect(valid).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("correct");
    const valid = await verifyPassword("wrong", hash);
    expect(valid).toBe(false);
  });
});
```

**Step 3: Run tests**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npm test`
Expected: All tests PASS

**Step 4: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add __tests__/
git commit -m "test: add unit tests for rate-limit and password utilities"
```

---

### Task 17: Tests for Validation Schemas

**Files:**
- Create: `__tests__/lib/validation.test.ts`

**Step 1: Write validation schema tests**

```typescript
// __tests__/lib/validation.test.ts
import { describe, it, expect } from "vitest";
import { CreateCustomerSchema, CreateChargeSchema, RegisterSchema } from "@/lib/validation";

describe("CreateCustomerSchema", () => {
  it("accepts valid customer data", () => {
    const result = CreateCustomerSchema.safeParse({
      name: "João Silva",
      doc: "12345678901",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = CreateCustomerSchema.safeParse({ doc: "123" });
    expect(result.success).toBe(false);
  });

  it("rejects missing doc", () => {
    const result = CreateCustomerSchema.safeParse({ name: "João" });
    expect(result.success).toBe(false);
  });
});

describe("CreateChargeSchema", () => {
  it("accepts valid charge data", () => {
    const result = CreateChargeSchema.safeParse({
      customerId: "cuid123",
      description: "Royalties Jan/2026",
      amountCents: 50000,
      dueDate: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative amount", () => {
    const result = CreateChargeSchema.safeParse({
      customerId: "cuid123",
      description: "Test",
      amountCents: -100,
      dueDate: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });
});

describe("RegisterSchema", () => {
  it("accepts valid registration", () => {
    const result = RegisterSchema.safeParse({
      email: "user@example.com",
      password: "123456",
      name: "Victor",
      empresaNome: "Menlo",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short password", () => {
    const result = RegisterSchema.safeParse({
      email: "user@example.com",
      password: "12345",
      name: "Victor",
      empresaNome: "Menlo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = RegisterSchema.safeParse({
      email: "not-an-email",
      password: "123456",
      name: "Victor",
      empresaNome: "Menlo",
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npm test`
Expected: All tests PASS

**Step 3: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add __tests__/lib/validation.test.ts
git commit -m "test: add unit tests for Zod validation schemas"
```

---

### Task 18: Extract Shared Formatters

**Files:**
- Create: `lib/formatters.ts`

**Step 1: Create formatters file**

```typescript
// lib/formatters.ts
export function fmtBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function fmtDate(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(dateStr + "T12:00:00"));
}

export function fmtDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateStr));
}

export function fmtCPFCNPJ(doc: string): string {
  const clean = doc.replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

export function fmtPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
```

**Step 2: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add lib/formatters.ts
git commit -m "feat: extract shared formatting utilities"
```

---

### Task 19: Cleanup — Rename Package and Remove Dead Code

**Files:**
- Modify: `package.json`
- Investigate: `backend/` directory

**Step 1: Rename package**

In `package.json`, change `"name": "asaas-mockup"` to `"name": "menlo-cobranca"`.

**Step 2: Check if backend/ is used**

Read `next.config.js` to verify the rewrite rule. If `BACKEND_URL` is not set in production, the backend/ folder is dead code and can be noted for removal (but don't delete without user confirmation).

**Step 3: Remove unused `pg` dependency**

Search for any imports of `pg` in the codebase. If none found:

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npm uninstall pg`

**Step 4: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add package.json package-lock.json
git commit -m "chore: rename package to menlo-cobranca, remove unused pg dependency"
```

---

## FASE 4: POLISH

---

### Task 20: Install Zustand and Create App Store

**Files:**
- Modify: `package.json`
- Create: `lib/stores/app-store.ts`
- Create: `lib/stores/preferences-store.ts`

**Step 1: Install Zustand**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npm install zustand`

**Step 2: Create app store**

```typescript
// lib/stores/app-store.ts
import { create } from "zustand";

interface AppState {
  overdueTasks: number;
  overdueCharges: number;
  inboxUnread: number;
  appNow: Date;
  setOverdueTasks: (count: number) => void;
  setOverdueCharges: (count: number) => void;
  setInboxUnread: (count: number) => void;
  setAppNow: (date: Date) => void;
}

export const useAppStore = create<AppState>((set) => ({
  overdueTasks: 0,
  overdueCharges: 0,
  inboxUnread: 0,
  appNow: new Date(),
  setOverdueTasks: (count) => set({ overdueTasks: count }),
  setOverdueCharges: (count) => set({ overdueCharges: count }),
  setInboxUnread: (count) => set({ inboxUnread: count }),
  setAppNow: (date) => set({ appNow: date }),
}));
```

**Step 3: Create preferences store**

```typescript
// lib/stores/preferences-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesState {
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
  sidebarCollapsed: boolean;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setDensity: (density: "comfortable" | "compact") => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "light",
      density: "comfortable",
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    { name: "menlo-preferences" }
  )
);
```

**Step 4: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add lib/stores/ package.json package-lock.json
git commit -m "feat: add Zustand stores for app state and preferences"
```

---

### Task 21: Install React Hook Form

**Files:**
- Modify: `package.json`

**Step 1: Install**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npm install react-hook-form @hookform/resolvers`

**Step 2: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add package.json package-lock.json
git commit -m "chore: install react-hook-form and resolvers"
```

---

### Task 22: Migrate Registration Form to React Hook Form

**Files:**
- Modify: `app/auth/registro/registro-form.tsx`

**Step 1: Read the current file**

**Step 2: Refactor to use React Hook Form + Zod**

```typescript
// Key changes in registro-form.tsx:
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterSchema, type RegisterInput } from "@/lib/validation/auth";

// Inside the component:
const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
} = useForm<RegisterInput>({
  resolver: zodResolver(RegisterSchema),
});

async function onSubmit(data: RegisterInput) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  // ... handle response
}

// Replace <form onSubmit={handleSubmit}> with:
<form onSubmit={handleSubmit(onSubmit)}>
  <input {...register("name")} />
  {errors.name && <span className="text-red-500 text-xs">{errors.name.message}</span>}
  {/* ... same for other fields */}
</form>
```

**Step 3: Verify build**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next build`

**Step 4: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add app/auth/registro/registro-form.tsx
git commit -m "refactor: migrate registration form to React Hook Form + Zod"
```

---

### Task 23: Migrate New Customer Form to React Hook Form

**Files:**
- Modify: `app/(dashboard)/clientes/novo/page.tsx`

Same pattern as Task 22 — use `CreateCustomerSchema` with `useForm` + `zodResolver`.

**Commit:**
```bash
git commit -m "refactor: migrate new customer form to React Hook Form + Zod"
```

---

### Task 24: Virtual Scrolling for Large Tables

**Files:**
- Modify: `package.json`

**Step 1: Install TanStack Virtual**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npm install @tanstack/react-virtual`

**Step 2: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add package.json package-lock.json
git commit -m "chore: install @tanstack/react-virtual for large table support"
```

Note: Integration into specific tables should be done per-page as datasets grow. The library is ready for use when needed.

---

### Task 25: Accessibility Improvements

**Files:**
- Modify: `components/ui/dialog.tsx`
- Modify: `app/(dashboard)/layout.tsx`

**Step 1: Add aria-live region for notifications**

In `app/(dashboard)/layout.tsx`, add near the bottom of the return:

```tsx
<div aria-live="polite" aria-atomic="true" className="sr-only" id="notifications-live">
  {/* Dynamic notifications will be announced here */}
</div>
```

**Step 2: Verify dialog has proper aria attributes**

Read `components/ui/dialog.tsx` — Radix UI Dialog should already handle `role="dialog"`, `aria-modal`, and focus trap. Verify and add `aria-describedby` if missing.

**Step 3: Commit**

```bash
cd /Users/victorsundfeld/cobranca-facil_v2
git add components/ui/dialog.tsx "app/(dashboard)/layout.tsx"
git commit -m "a11y: add aria-live region and verify dialog accessibility"
```

---

## Summary

| Fase | Tasks | Escopo |
|------|-------|--------|
| **Fase 1** | Tasks 1-7 | Rate limiting, logger, API handler, Zod validation, audit log, fix silent catches |
| **Fase 2** | Tasks 8-14 | React Query setup + migrations, server-side pagination, DB indexes |
| **Fase 3** | Tasks 15-19 | Vitest setup, unit tests, shared formatters, cleanup |
| **Fase 4** | Tasks 20-25 | Zustand, React Hook Form, virtual scrolling, accessibility |
