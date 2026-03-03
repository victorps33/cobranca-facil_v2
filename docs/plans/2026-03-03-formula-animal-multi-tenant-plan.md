# Fórmula Animal Multi-Tenant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a multi-franqueadora group system so Fórmula Animal can manage two subsidiaries (Remar and Fórmula) with a single super-user, a franchise selector in the sidebar, Júlia answering questions across both, and CSV upload for charges.

**Architecture:** New `GrupoFranqueadora` model groups multiple `Franqueadora` records. Users with `grupoFranqueadoraId` can switch between subsidiaries via a sidebar dropdown. `requireTenantOrGroup()` resolves `tenantIds[]` for all queries. Júlia's `buildDataContext` accepts multiple tenant IDs and labels data by subsidiary.

**Tech Stack:** Prisma (PostgreSQL), Next.js 14 App Router, NextAuth JWT, React Context, Anthropic Haiku 4.5, XLSX library (already installed)

---

### Task 1: Prisma Schema — GrupoFranqueadora Model

**Files:**
- Modify: `prisma/schema.prisma:23-45` (User model)
- Modify: `prisma/schema.prisma:235-256` (Franqueadora model)

**Step 1: Add GrupoFranqueadora model and relations**

Add before the `Franqueadora` model (around line 234):

```prisma
model GrupoFranqueadora {
  id              String          @id @default(cuid())
  nome            String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  franqueadoras   Franqueadora[]
  users           User[]
}
```

**Step 2: Add grupoId to Franqueadora model**

Add to the `Franqueadora` model (after line 237 `razaoSocial`):

```prisma
  grupoId            String?
  grupo              GrupoFranqueadora? @relation(fields: [grupoId], references: [id])
```

Add index: `@@index([grupoId])`

**Step 3: Add grupoFranqueadoraId to User model**

Add to the `User` model (after line 32 `franqueadora` relation):

```prisma
  grupoFranqueadoraId  String?
  grupoFranqueadora    GrupoFranqueadora? @relation(fields: [grupoFranqueadoraId], references: [id])
```

Add index: `@@index([grupoFranqueadoraId])`

**Step 4: Push schema changes**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx prisma db push`
Expected: Schema synced, no data loss

**Step 5: Generate Prisma client**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx prisma generate`
Expected: Prisma Client generated successfully

**Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add GrupoFranqueadora model for multi-tenant groups"
```

---

### Task 2: Auth Types — Extend NextAuth with grupoFranqueadoraId

**Files:**
- Modify: `types/next-auth.d.ts:1-28`

**Step 1: Add grupoFranqueadoraId to all type declarations**

Replace the full file content:

```typescript
import { UserRole } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      franqueadoraId: string | null;
      grupoFranqueadoraId: string | null;
      onboardingCompletedAt: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    franqueadoraId: string | null;
    grupoFranqueadoraId: string | null;
    onboardingCompletedAt: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    franqueadoraId: string | null;
    grupoFranqueadoraId: string | null;
    onboardingCompletedAt: string | null;
  }
}
```

**Step 2: Commit**

```bash
git add types/next-auth.d.ts
git commit -m "feat: extend NextAuth types with grupoFranqueadoraId"
```

---

### Task 3: Auth Config — Propagate grupoFranqueadoraId through JWT/Session

**Files:**
- Modify: `lib/auth.ts:36-166`

**Step 1: Update credentials authorize to include grupoFranqueadoraId**

In the `authorize` function (line 48-56), add `grupoFranqueadoraId`:

```typescript
return {
  id: user.id,
  email: user.email,
  name: user.name,
  image: user.image,
  role: user.role,
  franqueadoraId: user.franqueadoraId,
  grupoFranqueadoraId: user.grupoFranqueadoraId,
  onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
};
```

**Step 2: Update jwt callback to populate grupoFranqueadoraId**

In the `jwt` callback (line 120-154), add after `token.franqueadoraId = user.franqueadoraId;`:

```typescript
token.grupoFranqueadoraId = user.grupoFranqueadoraId;
```

In the DB re-fetch block (around line 130-141), also fetch `grupoFranqueadoraId`:

```typescript
select: { franqueadoraId: true, grupoFranqueadoraId: true, onboardingCompletedAt: true },
```

And add:

```typescript
if (dbUser?.grupoFranqueadoraId) {
  token.grupoFranqueadoraId = dbUser.grupoFranqueadoraId;
}
```

**Step 3: Update session callback**

In the `session` callback (line 156-164), add:

```typescript
session.user.grupoFranqueadoraId = token.grupoFranqueadoraId;
```

**Step 4: Update Google signIn callback**

In the `signIn` callback (line 112-115), add after `user.franqueadoraId`:

```typescript
user.grupoFranqueadoraId = dbUser.grupoFranqueadoraId;
```

**Step 5: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: propagate grupoFranqueadoraId through auth JWT and session"
```

---

### Task 4: Auth Helpers — requireTenantOrGroup

**Files:**
- Modify: `lib/auth-helpers.ts:1-51`

**Step 1: Add requireTenantOrGroup function**

Add after the existing `requireTenant` function:

```typescript
export async function requireTenantOrGroup(requestedFranqueadoraId?: string | null) {
  const { session, error } = await requireAuth();
  if (error) return { session: null, tenantIds: [] as string[], error };

  const grupoId = session!.user.grupoFranqueadoraId;
  const singleTenantId = session!.user.franqueadoraId;

  // User belongs to a group — resolve group franqueadoras
  if (grupoId) {
    const { prisma } = await import("@/lib/prisma");
    const grupo = await prisma.grupoFranqueadora.findUnique({
      where: { id: grupoId },
      include: { franqueadoras: { select: { id: true } } },
    });

    if (!grupo) {
      return {
        session: null,
        tenantIds: [] as string[],
        error: NextResponse.json({ error: "Grupo não encontrado" }, { status: 403 }),
      };
    }

    const groupIds = grupo.franqueadoras.map((f) => f.id);

    // If a specific franqueadora was requested, validate it belongs to the group
    if (requestedFranqueadoraId && requestedFranqueadoraId !== "all") {
      if (!groupIds.includes(requestedFranqueadoraId)) {
        return {
          session: null,
          tenantIds: [] as string[],
          error: NextResponse.json({ error: "Franqueadora não pertence ao grupo" }, { status: 403 }),
        };
      }
      return { session, tenantIds: [requestedFranqueadoraId], error: null };
    }

    // Return all group franqueadoras
    return { session, tenantIds: groupIds, error: null };
  }

  // Single-tenant user — same behavior as before
  if (!singleTenantId) {
    return {
      session: null,
      tenantIds: [] as string[],
      error: NextResponse.json({ error: "Tenant não configurado" }, { status: 403 }),
    };
  }

  return { session, tenantIds: [singleTenantId], error: null };
}
```

**Step 2: Commit**

```bash
git add lib/auth-helpers.ts
git commit -m "feat: add requireTenantOrGroup helper for multi-tenant resolution"
```

---

### Task 5: FranqueadoraContext — React Context for Active Selection

**Files:**
- Create: `components/providers/FranqueadoraProvider.tsx`

**Step 1: Create the context provider**

```typescript
"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";

interface FranqueadoraOption {
  id: string;
  nome: string;
}

interface FranqueadoraContextValue {
  /** Currently selected franqueadora ID, or "all" */
  activeFranqueadoraId: string;
  /** Set active franqueadora */
  setActiveFranqueadoraId: (id: string) => void;
  /** Available franqueadoras for this user */
  franqueadoras: FranqueadoraOption[];
  /** Whether the user is a group user */
  isGroupUser: boolean;
  /** Loading state */
  loading: boolean;
}

const FranqueadoraContext = createContext<FranqueadoraContextValue>({
  activeFranqueadoraId: "all",
  setActiveFranqueadoraId: () => {},
  franqueadoras: [],
  isGroupUser: false,
  loading: true,
});

export function useFranqueadora() {
  return useContext(FranqueadoraContext);
}

const STORAGE_KEY = "active_franqueadora_id";

export function FranqueadoraProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [franqueadoras, setFranqueadoras] = useState<FranqueadoraOption[]>([]);
  const [activeFranqueadoraId, setActiveId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const isGroupUser = !!session?.user?.grupoFranqueadoraId;

  // Fetch group franqueadoras
  useEffect(() => {
    if (!isGroupUser) {
      setLoading(false);
      return;
    }

    fetch("/api/grupo/franqueadoras")
      .then((r) => r.json())
      .then((data) => {
        setFranqueadoras(data.franqueadoras ?? []);
        // Restore last selection from localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && (stored === "all" || data.franqueadoras?.some((f: FranqueadoraOption) => f.id === stored))) {
          setActiveId(stored);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isGroupUser]);

  const setActiveFranqueadoraId = useCallback((id: string) => {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const value = useMemo(() => ({
    activeFranqueadoraId,
    setActiveFranqueadoraId,
    franqueadoras,
    isGroupUser,
    loading,
  }), [activeFranqueadoraId, setActiveFranqueadoraId, franqueadoras, isGroupUser, loading]);

  return (
    <FranqueadoraContext.Provider value={value}>
      {children}
    </FranqueadoraContext.Provider>
  );
}
```

**Step 2: Commit**

```bash
git add components/providers/FranqueadoraProvider.tsx
git commit -m "feat: add FranqueadoraProvider context for multi-tenant selection"
```

---

### Task 6: API — Group Franqueadoras Endpoint

**Files:**
- Create: `app/api/grupo/franqueadoras/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const grupoId = session!.user.grupoFranqueadoraId;
  if (!grupoId) {
    return NextResponse.json({ franqueadoras: [] });
  }

  const grupo = await prisma.grupoFranqueadora.findUnique({
    where: { id: grupoId },
    include: {
      franqueadoras: {
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      },
    },
  });

  return NextResponse.json({
    franqueadoras: grupo?.franqueadoras ?? [],
  });
}
```

**Step 2: Commit**

```bash
git add app/api/grupo/franqueadoras/route.ts
git commit -m "feat: add API endpoint for group franqueadoras"
```

---

### Task 7: Sidebar — Franqueadora Selector Dropdown

**Files:**
- Modify: `components/sidebar.tsx:1-223`

**Step 1: Add FranqueadoraSelector to sidebar**

Import `useFranqueadora` and add a dropdown between the Logo and Quick Action sections (after line 103, before line 105).

Add import:
```typescript
import { useFranqueadora } from "@/components/providers/FranqueadoraProvider";
import { Building2, ChevronDown } from "lucide-react";
```

Add inside `Sidebar()` function, after the existing hooks:
```typescript
const { isGroupUser, franqueadoras, activeFranqueadoraId, setActiveFranqueadoraId } = useFranqueadora();
```

Add JSX between Logo section and Quick Action section:

```tsx
{/* Franqueadora Selector — only for group users */}
{isGroupUser && !collapsed && (
  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
      Subsidiária
    </label>
    <div className="relative">
      <select
        value={activeFranqueadoraId}
        onChange={(e) => setActiveFranqueadoraId(e.target.value)}
        className="w-full appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
      >
        <option value="all">Todas</option>
        {franqueadoras.map((f) => (
          <option key={f.id} value={f.id}>{f.nome}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
    </div>
  </div>
)}
{isGroupUser && collapsed && (
  <div className="px-2 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-center">
    <button
      title={activeFranqueadoraId === "all" ? "Todas" : franqueadoras.find(f => f.id === activeFranqueadoraId)?.nome ?? ""}
      className="flex items-center justify-center h-8 w-8 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500"
    >
      <Building2 className="h-4 w-4" strokeWidth={1.5} />
    </button>
  </div>
)}
```

**Step 2: Commit**

```bash
git add components/sidebar.tsx
git commit -m "feat: add franqueadora selector dropdown in sidebar"
```

---

### Task 8: Dashboard Layout — Wire FranqueadoraProvider

**Files:**
- Modify: `app/(dashboard)/layout.tsx:1-123`

**Step 1: Add FranqueadoraProvider**

Import and wrap children:

```typescript
import { FranqueadoraProvider } from "@/components/providers/FranqueadoraProvider";
```

Wrap the return JSX — add `<FranqueadoraProvider>` inside `<AppDataProvider>`:

```tsx
<AppDataProvider>
  <FranqueadoraProvider>
    <div className="flex h-screen bg-background overflow-hidden">
      ...
    </div>
  </FranqueadoraProvider>
</AppDataProvider>
```

**Step 2: Commit**

```bash
git add app/(dashboard)/layout.tsx
git commit -m "feat: wire FranqueadoraProvider into dashboard layout"
```

---

### Task 9: Júlia Chat — Multi-Tenant Data Context

**Files:**
- Modify: `app/api/chat/route.ts:149-288` (buildDataContext function)
- Modify: `app/api/chat/route.ts:308-354` (POST handler)

**Step 1: Update buildDataContext to accept tenantIds[]**

Change the signature and queries:

```typescript
async function buildDataContext(tenantIds: string[]): Promise<string> {
```

Update the Prisma queries to use `{ in: tenantIds }`:

```typescript
const customers = await prisma.customer.findMany({
  where: { franqueadoraId: { in: tenantIds } },
  include: { charges: true, franqueadora: { select: { nome: true } } },
});

const charges = await prisma.charge.findMany({
  where: { customer: { franqueadoraId: { in: tenantIds } } },
  include: { customer: { include: { franqueadora: { select: { nome: true } } } } },
});
```

When `tenantIds.length > 1`, organize data by subsidiary name in the context string:

```typescript
if (tenantIds.length > 1) {
  // Group data by franqueadora
  const franqueadoraNames = new Map<string, string>();
  customers.forEach(c => {
    if (c.franqueadoraId && c.franqueadora?.nome) {
      franqueadoraNames.set(c.franqueadoraId, c.franqueadora.nome);
    }
  });

  let contextParts: string[] = [];
  for (const [fId, fName] of franqueadoraNames) {
    const fCustomers = customers.filter(c => c.franqueadoraId === fId);
    const fCharges = charges.filter(c => c.customer?.franqueadoraId === fId);
    // Build per-subsidiary context using existing logic...
    contextParts.push(`\n## SUBSIDIÁRIA: ${fName}\n${buildSubsidiaryContext(fCustomers, fCharges, fmtBRL)}`);
  }

  return `\n=== DADOS DA REDE (VISÃO CONSOLIDADA) ===\n${contextParts.join("\n")}\n===`;
}
```

Extract the existing single-tenant context building into a helper function `buildSubsidiaryContext` to avoid duplication.

**Step 2: Update POST handler to use requireTenantOrGroup**

Replace `requireTenant()` with `requireTenantOrGroup()`:

```typescript
import { requireTenantOrGroup } from "@/lib/auth-helpers";

// In POST handler:
const requestedFranqueadoraId = request.headers.get("x-franqueadora-id") || null;
const { session, tenantIds, error } = await requireTenantOrGroup(
  requestedFranqueadoraId === "all" ? null : requestedFranqueadoraId
);
if (error) return error;
```

Update `buildDataContext` call:
```typescript
const dataContext = anonymizeContext(await buildDataContext(tenantIds));
```

Update cache key to include tenantIds:
```typescript
const cacheKey = isPreset ? getCacheKey(lastUserMessage, tenantIds.join(","), detailLevel) : "";
```

**Step 3: Update Júlia system prompt for multi-subsidiary**

Add to `JULIA_SYSTEM_PROMPT` (append after existing content):

```typescript
const MULTI_SUBSIDIARY_INSTRUCTION = `

Quando os dados contêm múltiplas subsidiárias:
- Identifique cada subsidiária pelo nome
- Permita comparações diretas entre elas (ex: inadimplência, PMR, recebimentos)
- Na visão consolidada, apresente totais gerais E quebra por subsidiária
- Se perguntarem sobre uma subsidiária específica, foque nela`;
```

Include this instruction when `tenantIds.length > 1`.

**Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: Júlia supports multi-tenant context with subsidiary comparisons"
```

---

### Task 10: Charges CSV Import — API Endpoint

**Files:**
- Create: `app/api/charges/upload/route.ts`

**Step 1: Create the charges upload endpoint**

```typescript
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";

function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith("sk-ant-your")) return null;
  return new Anthropic({ apiKey: key });
}

export async function POST(request: Request) {
  const requestedFranqueadoraId = request.headers.get("x-franqueadora-id") || null;
  const { session, tenantIds, error } = await requireTenantOrGroup(
    requestedFranqueadoraId === "all" ? null : requestedFranqueadoraId
  );
  if (error) return error;

  // For charge upload, require a specific franqueadora (not "all")
  const targetFranqueadoraId = requestedFranqueadoraId && requestedFranqueadoraId !== "all"
    ? requestedFranqueadoraId
    : tenantIds.length === 1 ? tenantIds[0] : null;

  if (!targetFranqueadoraId) {
    return NextResponse.json(
      { error: "Selecione uma subsidiária específica para importar cobranças." },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isText = [".csv", ".txt", ".tsv"].includes(ext);
    let fileContent = isText ? buffer.toString("utf-8") : buffer.toString("utf-8").substring(0, 50000);

    // Fetch existing customers for this franqueadora (for matching)
    const customers = await prisma.customer.findMany({
      where: { franqueadoraId: targetFranqueadoraId },
      select: { id: true, name: true, doc: true, email: true },
    });

    const customerList = customers.map(c => `ID: ${c.id}, Nome: ${c.name}, Doc: ${c.doc}, Email: ${c.email}`).join("\n");

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json({ error: "API de IA não configurada." }, { status: 503 });
    }

    const prompt = `Você é um assistente especializado em extrair dados de cobranças a partir de arquivos.

O usuário enviou "${file.name}". Extraia as cobranças e associe cada uma a um cliente existente.

Clientes existentes:
${customerList}

Conteúdo do arquivo:
---
${fileContent.substring(0, 40000)}
---

Retorne EXCLUSIVAMENTE um JSON válido:
{
  "charges": [
    {
      "customerName": "Nome exato do cliente (para matching)",
      "customerId": "ID do cliente se encontrado na lista acima, ou null",
      "description": "Descrição da cobrança",
      "amountCents": 10000,
      "dueDate": "YYYY-MM-DD",
      "status": "PENDING ou PAID ou OVERDUE",
      "paidAt": "YYYY-MM-DD ou null",
      "categoria": "categoria se disponível",
      "competencia": "MM/YYYY se disponível"
    }
  ],
  "warnings": ["avisos"],
  "summary": "resumo"
}

Regras:
- amountCents em centavos (R$ 100,00 = 10000). Se o valor parecer em reais, converta.
- dueDate obrigatório. Se não encontrado, use data atual.
- status: se paidAt existe → PAID, se dueDate < hoje → OVERDUE, senão PENDING
- Tente associar ao customerId da lista pelo nome mais similar
- Retorne APENAS o JSON`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === "text");
    const rawResponse = textContent?.text ?? "";

    let parsed: { charges: Record<string, unknown>[]; warnings: string[]; summary: string };
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "Não foi possível interpretar o arquivo." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      charges: parsed.charges ?? [],
      warnings: parsed.warnings ?? [],
      summary: parsed.summary ?? "",
      targetFranqueadoraId,
    });
  } catch (error) {
    console.error("Error in charges upload:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add app/api/charges/upload/route.ts
git commit -m "feat: add AI-powered charges CSV upload endpoint"
```

---

### Task 11: Charges CSV Import — Confirm & Save Endpoint

**Files:**
- Create: `app/api/charges/upload/confirm/route.ts`

**Step 1: Create the confirm endpoint**

This endpoint receives the parsed charges (after user preview) and creates them in the DB:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup, requireRole } from "@/lib/auth-helpers";
import { createHash } from "crypto";

export async function POST(request: Request) {
  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const body = await request.json();
    const { charges, franqueadoraId } = body;

    if (!charges || !Array.isArray(charges) || charges.length === 0) {
      return NextResponse.json({ error: "Nenhuma cobrança para importar." }, { status: 400 });
    }

    if (!franqueadoraId) {
      return NextResponse.json({ error: "franqueadoraId obrigatório." }, { status: 400 });
    }

    // Validate franqueadora access
    const requestedFranqueadoraId = franqueadoraId;
    const { tenantIds, error } = await requireTenantOrGroup(requestedFranqueadoraId);
    if (error) return error;

    const created = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const charge of charges) {
        if (!charge.customerId || !charge.amountCents || !charge.dueDate) continue;

        // Verify customer belongs to this franqueadora
        const customer = await tx.customer.findFirst({
          where: { id: charge.customerId, franqueadoraId },
        });
        if (!customer) continue;

        const newCharge = await tx.charge.create({
          data: {
            customerId: charge.customerId,
            description: charge.description || "Cobrança importada",
            amountCents: Math.round(Number(charge.amountCents)),
            dueDate: new Date(charge.dueDate),
            status: charge.status || "PENDING",
            paidAt: charge.paidAt ? new Date(charge.paidAt) : null,
            categoria: charge.categoria || null,
            competencia: charge.competencia || null,
          },
        });

        // Generate boleto
        const hash = createHash("sha256").update(newCharge.id).digest("hex");
        await tx.boleto.create({
          data: {
            chargeId: newCharge.id,
            linhaDigitavel: `23793.${hash.slice(0, 5)} ${hash.slice(5, 10)}.${hash.slice(10, 15)} ${hash.slice(15, 20)}.${hash.slice(20, 25)} ${hash.slice(25, 26)} ${hash.slice(26, 40)}`,
            barcodeValue: hash.slice(0, 44),
            publicUrl: `https://menlocobranca.vercel.app/boleto/${newCharge.id}`,
          },
        });

        results.push(newCharge);
      }

      return results;
    });

    return NextResponse.json({
      imported: created.length,
      total: charges.length,
    });
  } catch (error) {
    console.error("Error confirming charges import:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add app/api/charges/upload/confirm/route.ts
git commit -m "feat: add charges import confirmation endpoint with boleto generation"
```

---

### Task 12: Charges Import UI — Dialog Component

**Files:**
- Create: `components/cobrancas/ImportChargesDialog.tsx`

**Step 1: Create the import dialog**

Build a dialog similar to `components/franqueados/ImportDialog.tsx` but for charges:
- Drag & drop file upload
- AI processing with spinner
- Preview table (customer, description, amount, due date, status)
- Confirm button that calls `/api/charges/upload/confirm`
- Uses `useFranqueadora()` to pass `x-franqueadora-id` header

Key differences from the franqueados import:
- Shows amount formatted as BRL
- Shows due date
- Requires a specific franqueadora selected (not "all")
- Calls `/api/charges/upload` for parsing then `/api/charges/upload/confirm` to save

**Step 2: Wire into cobranças page**

Add an "Importar" button to the cobranças page header that opens this dialog.

**Step 3: Commit**

```bash
git add components/cobrancas/ImportChargesDialog.tsx
git commit -m "feat: add charges import dialog with AI parsing and preview"
```

---

### Task 13: Seed Script — Fórmula Animal Setup

**Files:**
- Create: `prisma/seed-formula-animal.ts`

**Step 1: Create the seed script**

```typescript
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { createDefaultDunningRule } from "../lib/default-dunning-rule";

const prisma = new PrismaClient();

async function main() {
  console.log("Creating Fórmula Animal group...");

  await prisma.$transaction(async (tx) => {
    // 1. Create GrupoFranqueadora
    const grupo = await tx.grupoFranqueadora.create({
      data: {
        nome: "Fórmula Animal",
      },
    });
    console.log(`  Grupo: ${grupo.nome} (${grupo.id})`);

    // 2. Create Franqueadora: Remar
    const remar = await tx.franqueadora.create({
      data: {
        nome: "Remar",
        razaoSocial: "Remar Ltda",
        email: "remar@formulaanimal.com.br",
        grupoId: grupo.id,
      },
    });
    console.log(`  Franqueadora: ${remar.nome} (${remar.id})`);

    // 3. Create Franqueadora: Fórmula
    const formula = await tx.franqueadora.create({
      data: {
        nome: "Fórmula",
        razaoSocial: "Fórmula Ltda",
        email: "formula@formulaanimal.com.br",
        grupoId: grupo.id,
      },
    });
    console.log(`  Franqueadora: ${formula.nome} (${formula.id})`);

    // 4. Create default dunning rules for both
    await createDefaultDunningRule(tx, remar.id);
    await createDefaultDunningRule(tx, formula.id);
    console.log("  Dunning rules created for both");

    // 5. Create AgentConfig for both
    await tx.agentConfig.create({
      data: { franqueadoraId: remar.id, enabled: true },
    });
    await tx.agentConfig.create({
      data: { franqueadoraId: formula.id, enabled: true },
    });
    console.log("  Agent configs created for both");

    // 6. Create admin user
    const hashedPassword = await hashPassword("formula2024");
    const user = await tx.user.create({
      data: {
        name: "Admin Fórmula Animal",
        email: "admin@formulaanimal.com.br",
        password: hashedPassword,
        role: "ADMINISTRADOR",
        grupoFranqueadoraId: grupo.id,
        // No franqueadoraId — accesses via group
      },
    });
    console.log(`  User: ${user.email} (${user.id})`);
    console.log(`  Password: formula2024`);
  });

  console.log("\nDone! Login with: admin@formulaanimal.com.br / formula2024");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: Run the seed**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx tsx prisma/seed-formula-animal.ts`
Expected: Grupo, 2 franqueadoras, dunning rules, agent configs, and admin user created

**Step 3: Commit**

```bash
git add prisma/seed-formula-animal.ts
git commit -m "feat: add seed script for Fórmula Animal group setup"
```

---

### Task 14: Update Existing API Routes to Support x-franqueadora-id Header

**Files:**
- Modify: All API routes under `app/api/` that use `requireTenant()`

**Step 1: Identify all routes using requireTenant()**

Search for `requireTenant()` across all API routes. For each route:
- Replace `requireTenant()` with `requireTenantOrGroup(request.headers.get("x-franqueadora-id"))`
- Replace `tenantId` with `tenantIds` (use `{ in: tenantIds }` in Prisma where clauses)

Key routes to update:
- `app/api/customers/route.ts`
- `app/api/charges/route.ts`
- `app/api/crm/*/route.ts`
- `app/api/dunning-rules/route.ts`
- `app/api/dunning-steps/route.ts`
- `app/api/logs/route.ts`
- `app/api/inbox/*/route.ts`
- Dashboard stats endpoints

For routes that **write** data (POST/PUT), require a specific franqueadoraId (not "all") to determine which tenant owns the new record.

**Step 2: Update frontend API calls to pass header**

Create a utility function in `lib/api.ts`:

```typescript
export function getFranqueadoraHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const active = localStorage.getItem("active_franqueadora_id");
  if (active) return { "x-franqueadora-id": active };
  return {};
}
```

Update fetch calls throughout the app to include this header.

**Step 3: Commit incrementally**

One commit per logical group of route updates.

---

### Task 15: Integration Test — Full Flow Verification

**Step 1: Start dev server**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npm run dev`

**Step 2: Verify seed data**

Check that the Fórmula Animal group, Remar, Fórmula, and admin user were created correctly in the database.

**Step 3: Test login**

Login with `admin@formulaanimal.com.br` / `formula2024`. Verify:
- Sidebar shows franqueadora selector with "Todas", "Remar", "Fórmula"
- Switching between them updates the displayed data

**Step 4: Test CSV upload**

Upload a CSV with customer data for Remar, then for Fórmula. Verify:
- Customers appear under the correct franqueadora
- Switching to "Todas" shows all customers

**Step 5: Test Júlia**

Ask Júlia questions:
- With "Remar" selected: "Qual o status da rede?" → Should only show Remar data
- With "Todas" selected: "Compare a inadimplência da Remar e Fórmula" → Should show both
- Verify preset questions work correctly

**Step 6: Final commit**

```bash
git commit -m "feat: Fórmula Animal multi-tenant group — complete implementation"
```
