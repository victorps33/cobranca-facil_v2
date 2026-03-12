# Frontend Multi-ERP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add UI for ERP connection in settings and invoice (NF) status display on charge detail page.

**Architecture:** Three new files (API route, ERP config section component, Omie dialog component) plus modifications to four existing files (types, charges API, settings page, charge detail page). The frontend calls `GET/POST/PATCH /api/erp-config` for ERP configuration and uses the existing `POST /api/charges/[id]/invoice` endpoint for NF emission.

**Tech Stack:** Next.js 14 (App Router), React, shadcn/ui (Radix), Tailwind CSS, Prisma, fetchWithTenant

**Spec:** `docs/superpowers/specs/2026-03-12-erp-frontend-design.md`

---

## Chunk 1: API + Types

### Task 1: Add invoice fields to Cobranca type

**Files:**
- Modify: `lib/types/index.ts:26-44`

The `Cobranca` interface is the frontend's charge representation. The Prisma `Charge` model already has `invoiceNumber`, `invoiceStatus`, `invoicePdfUrl`, `invoiceIssuedAt` but they aren't exposed to the frontend yet.

- [ ] **Step 1: Add invoice fields to Cobranca interface**

In `lib/types/index.ts`, add these 4 optional fields to the `Cobranca` interface after `boletoUrl`:

```typescript
// Add after line 43 (boletoUrl?: string;)
invoiceNumber?: string;
invoiceStatus?: string;    // "EMITIDA" | "CANCELADA" | "PENDENTE" | null
invoicePdfUrl?: string;
invoiceIssuedAt?: string;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"`
Expected: Same number of pre-existing errors (no new ones)

- [ ] **Step 3: Commit**

```bash
git add lib/types/index.ts
git commit -m "feat(frontend): add invoice fields to Cobranca type"
```

---

### Task 2: Expose invoice fields in charges API response

**Files:**
- Modify: `app/api/charges/route.ts:39-57`

The GET `/api/charges` endpoint maps Prisma fields to the Cobranca shape. Currently it omits the invoice fields. We need to include them so the charge detail page can display NF status.

- [ ] **Step 1: Add invoice fields to the enriched response**

In `app/api/charges/route.ts`, inside the `charges.map((c) => { ... return { ... } })` block, add these fields after the `boletoUrl` line (line 56):

```typescript
// Add after: boletoUrl: c.boleto?.publicUrl || undefined,
invoiceNumber: c.invoiceNumber || undefined,
invoiceStatus: c.invoiceStatus || undefined,
invoicePdfUrl: c.invoicePdfUrl || undefined,
invoiceIssuedAt: c.invoiceIssuedAt ? c.invoiceIssuedAt.toISOString() : undefined,
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"`
Expected: Same number of pre-existing errors

- [ ] **Step 3: Commit**

```bash
git add app/api/charges/route.ts
git commit -m "feat(frontend): expose invoice fields in charges API response"
```

---

### Task 3: Create ERP config API route

**Files:**
- Create: `app/api/erp-config/route.ts`

**Context:** The `ERPConfig` Prisma model (schema line 209-234) stores per-franqueadora ERP credentials. Fields: `provider` (OMIE | CONTA_AZUL | NONE), `omieAppKey`, `omieAppSecret`, `lastSyncAt`, `syncEnabled`. The `Franqueadora` model has an `erpConfig` relation.

Auth pattern: use `requireTenant()` from `@/lib/auth-helpers` for tenantId, `requireRole(["ADMINISTRADOR"])` for admin check. Response pattern: `NextResponse.json(...)`.

This endpoint supports 3 methods:
- **GET:** Return current ERP config (without secrets)
- **POST:** Create or update ERP config (upsert)
- **PATCH:** Partial update (used for disconnect: `{ provider: "NONE" }`)

- [ ] **Step 1: Create the API route file**

Create `app/api/erp-config/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

// GET /api/erp-config — Return ERP config for authenticated franqueadora (no secrets)
export async function GET() {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const config = await prisma.eRPConfig.findUnique({
    where: { franqueadoraId: tenantId! },
  });

  if (!config) {
    return NextResponse.json({ provider: "NONE", lastSyncAt: null, syncEnabled: false });
  }

  return NextResponse.json({
    provider: config.provider,
    lastSyncAt: config.lastSyncAt?.toISOString() || null,
    syncEnabled: config.syncEnabled,
    hasOmieCredentials: !!(config.omieAppKey && config.omieAppSecret),
  });
}

// POST /api/erp-config — Create or update ERP config
export async function POST(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  const body = await req.json();
  const { provider, omieAppKey, omieAppSecret } = body;

  if (!provider || !["OMIE", "CONTA_AZUL", "NONE"].includes(provider)) {
    return NextResponse.json(
      { error: "Provider inválido. Use OMIE, CONTA_AZUL ou NONE." },
      { status: 400 }
    );
  }

  if (provider === "OMIE" && (!omieAppKey || !omieAppSecret)) {
    return NextResponse.json(
      { error: "App Key e App Secret são obrigatórios para Omie." },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = { provider };
  if (provider === "OMIE") {
    data.omieAppKey = omieAppKey;
    data.omieAppSecret = omieAppSecret;
  }
  if (provider === "NONE") {
    data.omieAppKey = null;
    data.omieAppSecret = null;
    data.syncEnabled = false;
  }

  const config = await prisma.eRPConfig.upsert({
    where: { franqueadoraId: tenantId! },
    create: {
      franqueadoraId: tenantId!,
      ...data,
    } as any,
    update: data as any,
  });

  return NextResponse.json({ success: true, provider: config.provider });
}

// PATCH /api/erp-config — Partial update (e.g., disconnect)
export async function PATCH(req: NextRequest) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  const body = await req.json();
  const { provider } = body;

  const existing = await prisma.eRPConfig.findUnique({
    where: { franqueadoraId: tenantId! },
  });

  if (!existing) {
    return NextResponse.json({ error: "Nenhuma configuração de ERP encontrada." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (provider !== undefined) {
    data.provider = provider;
    if (provider === "NONE") {
      data.omieAppKey = null;
      data.omieAppSecret = null;
      data.syncEnabled = false;
    }
  }

  const config = await prisma.eRPConfig.update({
    where: { franqueadoraId: tenantId! },
    data: data as any,
  });

  return NextResponse.json({ success: true, provider: config.provider });
}
```

- [ ] **Step 2: Verify the route file compiles**

Run: `npx tsc --noEmit 2>&1 | grep "erp-config" || echo "No new errors in erp-config"`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/api/erp-config/route.ts
git commit -m "feat(frontend): add ERP config CRUD API route"
```

---

## Chunk 2: ERP Settings Components

### Task 4: Create Omie config dialog component

**Files:**
- Create: `components/configuracoes/omie-config-dialog.tsx`

**Context:** This dialog is opened when the user clicks "Configurar" on the Omie row in the ERP section. It has two text inputs (App Key, App Secret) and a Save button that POSTs to `/api/erp-config`.

Follow the pattern from `EmitirNfDialog` (`components/cobrancas/EmitirNfDialog.tsx`): uses `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `@/components/ui/dialog`.

For API calls, use `fetchWithTenant` from `@/lib/fetch-with-tenant`.

Use `toast` from `@/components/ui/use-toast` for success/error notifications.

- [ ] **Step 1: Create the dialog component**

Create `components/configuracoes/omie-config-dialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { fetchWithTenant } from "@/lib/fetch-with-tenant";

interface OmieConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function OmieConfigDialog({
  open,
  onOpenChange,
  onSaved,
}: OmieConfigDialogProps) {
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!appKey.trim() || !appSecret.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha App Key e App Secret.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithTenant("/api/erp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "OMIE",
          omieAppKey: appKey.trim(),
          omieAppSecret: appSecret.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar");
      }

      toast({
        title: "Omie configurado",
        description: "Credenciais salvas com sucesso.",
      });
      setAppKey("");
      setAppSecret("");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Falha ao salvar configuração.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      setAppKey("");
      setAppSecret("");
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Omie</DialogTitle>
          <DialogDescription>
            Insira as credenciais da API do Omie para sua franqueadora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="omie-app-key">App Key</Label>
            <Input
              id="omie-app-key"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              placeholder="Sua App Key do Omie"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="omie-app-secret">App Secret</Label>
            <Input
              id="omie-app-secret"
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="Sua App Secret do Omie"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => handleClose(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "omie-config-dialog" || echo "No new errors"`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add components/configuracoes/omie-config-dialog.tsx
git commit -m "feat(frontend): add Omie credentials config dialog"
```

---

### Task 5: Create ERP config section component

**Files:**
- Create: `components/configuracoes/erp-config-section.tsx`

**Context:** This component renders the "ERP / Sistema de Gestão" section in the Integrações tab. It shows a list of two ERP options (Omie, Conta Azul) as rows. On mount, it fetches the current ERP config via `GET /api/erp-config` to determine which (if any) is connected.

**Layout per the spec (lista simples):**
- Each ERP is a rounded row with: icon area (40x40), name + description, action button
- Connected ERP: green background (`bg-emerald-50 border-emerald-200`), "✓ Configurado/Conectado" text, "Desconectar" button
- Disconnected ERP: white background, "Configurar" (Omie) or "Conectar" (Conta Azul) button
- When one ERP is active, the other row is visually disabled (`opacity-50 pointer-events-none`)

**API calls:**
- `GET /api/erp-config` — on mount, to get current state
- `PATCH /api/erp-config` with `{ provider: "NONE" }` — to disconnect
- For Omie: opens `OmieConfigDialog` which does the POST
- For Conta Azul: redirects to `/api/integrations/conta-azul/authorize`

Use `fetchWithTenant` from `@/lib/fetch-with-tenant`.

- [ ] **Step 1: Create the component**

Create `components/configuracoes/erp-config-section.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { fetchWithTenant } from "@/lib/fetch-with-tenant";
import { OmieConfigDialog } from "./omie-config-dialog";

interface ERPConfigState {
  provider: string;
  lastSyncAt: string | null;
  syncEnabled: boolean;
  hasOmieCredentials: boolean;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export function ERPConfigSection() {
  const [config, setConfig] = useState<ERPConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [omieDialogOpen, setOmieDialogOpen] = useState(false);

  const fetchConfig = useCallback(() => {
    fetchWithTenant("/api/erp-config")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch(() => setConfig({ provider: "NONE", lastSyncAt: null, syncEnabled: false, hasOmieCredentials: false }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetchWithTenant("/api/erp-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "NONE" }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "ERP desconectado", description: "Integração removida." });
      fetchConfig();
    } catch {
      toast({ title: "Erro", description: "Falha ao desconectar.", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleContaAzulConnect = () => {
    window.location.href = "/api/integrations/conta-azul/authorize";
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">ERP / Sistema de Gestão</span>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const activeProvider = config?.provider || "NONE";
  const isOmieActive = activeProvider === "OMIE";
  const isContaAzulActive = activeProvider === "CONTA_AZUL";
  const hasActive = isOmieActive || isContaAzulActive;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">ERP / Sistema de Gestão</span>
        </div>
        <p className="text-xs text-gray-500 mt-1 ml-6">
          Conecte seu ERP para sincronizar clientes, cobranças e notas fiscais.
        </p>
      </div>

      {/* Omie row */}
      <div
        className={`rounded-xl border p-4 flex items-center justify-between transition-colors ${
          isOmieActive
            ? "bg-emerald-50 border-emerald-200"
            : hasActive
              ? "bg-white border-gray-200 opacity-50 pointer-events-none"
              : "bg-white border-gray-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg">
            📊
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Omie</div>
            {isOmieActive ? (
              <div className="text-xs text-emerald-700">
                ✓ Configurado
                {config?.lastSyncAt && ` — Última sync ${timeAgo(config.lastSyncAt)}`}
              </div>
            ) : (
              <div className="text-xs text-gray-500">Credenciais via API Key</div>
            )}
          </div>
        </div>
        {isOmieActive ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            {disconnecting ? "..." : "Desconectar"}
          </button>
        ) : (
          <button
            onClick={() => setOmieDialogOpen(true)}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Configurar
          </button>
        )}
      </div>

      {/* Conta Azul row */}
      <div
        className={`rounded-xl border p-4 flex items-center justify-between transition-colors ${
          isContaAzulActive
            ? "bg-emerald-50 border-emerald-200"
            : hasActive
              ? "bg-white border-gray-200 opacity-50 pointer-events-none"
              : "bg-white border-gray-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-lg">
            🔵
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Conta Azul</div>
            {isContaAzulActive ? (
              <div className="text-xs text-emerald-700">
                ✓ Conectado
                {config?.lastSyncAt && ` — Última sync ${timeAgo(config.lastSyncAt)}`}
              </div>
            ) : (
              <div className="text-xs text-gray-500">OAuth2</div>
            )}
          </div>
        </div>
        {isContaAzulActive ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            {disconnecting ? "..." : "Desconectar"}
          </button>
        ) : (
          <button
            onClick={handleContaAzulConnect}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Conectar
          </button>
        )}
      </div>

      <OmieConfigDialog
        open={omieDialogOpen}
        onOpenChange={setOmieDialogOpen}
        onSaved={fetchConfig}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "erp-config-section" || echo "No new errors"`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add components/configuracoes/erp-config-section.tsx
git commit -m "feat(frontend): add ERP config section component for settings"
```

---

## Chunk 3: Page Integrations

### Task 6: Add ERP section to Integrações tab

**Files:**
- Modify: `app/(dashboard)/configuracoes/page.tsx:396-491`

**Context:** The `IntegracoesContent` function (line 396) renders the Integrações tab. It currently shows: title → TwilioNumbersSection → hr → Julia IA card → Julia toggle → Fontes de dados → Webhook URL → Save button.

Per the spec, the ERP section goes **above** the existing integrations. We need to:
1. Import `ERPConfigSection`
2. Add `<ERPConfigSection />` right after the title, before `<TwilioNumbersSection />`

- [ ] **Step 1: Add import for ERPConfigSection**

In `app/(dashboard)/configuracoes/page.tsx`, add this import after the existing imports (after line 37):

```typescript
import { ERPConfigSection } from "@/components/configuracoes/erp-config-section";
```

- [ ] **Step 2: Add ERPConfigSection to IntegracoesContent**

In the `IntegracoesContent` function, insert `<ERPConfigSection />` and an `<hr>` between the title block and `<TwilioNumbersSection />`.

Find this code (lines 427-433):
```
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Integrações</h2>
        <p className="text-sm text-gray-500 mt-1">Conecte APIs e fontes de dados externas.</p>
      </div>

      <TwilioNumbersSection />
```

Replace with:
```
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Integrações</h2>
        <p className="text-sm text-gray-500 mt-1">Conecte APIs e fontes de dados externas.</p>
      </div>

      <ERPConfigSection />

      <hr className="border-gray-100" />

      <TwilioNumbersSection />
```

- [ ] **Step 3: Verify the page renders**

Run: `npx tsc --noEmit 2>&1 | grep "configuracoes/page" || echo "No new errors"`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/configuracoes/page.tsx
git commit -m "feat(frontend): add ERP config section to Integrações tab"
```

---

### Task 7: Add NF status badge and EmitirNfDialog to charge detail page

**Files:**
- Modify: `app/(dashboard)/cobrancas/[id]/page.tsx`

**Context:** The charge detail page (`CobrancaDetalhePage`) has a sidebar with a "Links" section (line 486-527). Currently there's a "Baixar nota fiscal" button that opens `NotaFiscalViewerDialog`. The `EmitirNfDialog` component exists but is NOT imported or used on this page.

We need to:
1. Import `EmitirNfDialog`
2. Add state for `emitirNfOpen`
3. Replace the static "Baixar nota fiscal" link with an invoice-aware block:
   - If `invoiceStatus` is `null`: show "Emitir NF" button → opens EmitirNfDialog
   - If `invoiceStatus === "PENDENTE"`: show "Emitindo..." with yellow badge, button disabled
   - If `invoiceStatus === "EMITIDA"`: show "NF #XXX" green badge + "Baixar NF" link
   - If `invoiceStatus === "CANCELADA"`: show "Cancelada" red badge
4. Wire EmitirNfDialog's `onEmitir` to call `POST /api/charges/[id]/invoice` via `fetchWithTenant`
5. Add EmitirNfDialog to the dialogs section at the bottom

- [ ] **Step 1: Add EmitirNfDialog import**

In `app/(dashboard)/cobrancas/[id]/page.tsx`, add this import after the existing dialog imports (after line 26):

```typescript
import { EmitirNfDialog } from "@/components/cobrancas/EmitirNfDialog";
import { fetchWithTenant } from "@/lib/fetch-with-tenant";
import { toast } from "@/components/ui/use-toast";
```

- [ ] **Step 2: Add state variables**

Inside `CobrancaDetalhePage`, after the existing state declarations (after line 65):

```typescript
const [emitirNfOpen, setEmitirNfOpen] = useState(false);
const [emittingNf, setEmittingNf] = useState(false);
```

- [ ] **Step 3: Add onEmitirNf handler**

After the `copy` function (after line 150), add:

```typescript
async function handleEmitirNf(cobrancaId: string, comBoleto: boolean) {
  setEmittingNf(true);
  try {
    const res = await fetchWithTenant(`/api/charges/${cobrancaId}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comBoleto }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Erro ao emitir NF");
    }
    toast({ title: "NF solicitada", description: "A nota fiscal está sendo emitida." });
    // Update local state to show PENDENTE
    setCobranca((prev) =>
      prev ? { ...prev, invoiceStatus: "PENDENTE" } : prev
    );
  } catch (err: any) {
    toast({
      title: "Erro",
      description: err.message || "Falha ao solicitar emissão de NF.",
      variant: "destructive",
    });
  } finally {
    setEmittingNf(false);
  }
}
```

- [ ] **Step 4: Replace the "Baixar nota fiscal" link with invoice-aware block**

Find this code in the Links section (lines 486-493):

```jsx
            {/* Links */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => setNfViewerOpen(true)}
                className="flex items-center gap-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Baixar nota fiscal
              </button>
```

Replace with:

```jsx
            {/* Links */}
            <div className="space-y-2.5 pt-1">
              {/* NF Status + Action */}
              {cobranca.invoiceStatus === "EMITIDA" ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      NF {cobranca.invoiceNumber ? `#${cobranca.invoiceNumber}` : "Emitida"}
                    </span>
                  </div>
                  <button
                    onClick={() => cobranca.invoicePdfUrl ? window.open(cobranca.invoicePdfUrl, "_blank") : setNfViewerOpen(true)}
                    className="flex items-center gap-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    Baixar NF
                  </button>
                </>
              ) : cobranca.invoiceStatus === "PENDENTE" ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                      Emitindo...
                    </span>
                  </div>
                  <button
                    disabled
                    className="flex items-center gap-2.5 text-sm font-medium text-gray-400 cursor-not-allowed"
                  >
                    <FileText className="h-4 w-4" />
                    Emitindo NF...
                  </button>
                </>
              ) : cobranca.invoiceStatus === "CANCELADA" ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                      NF Cancelada
                    </span>
                  </div>
                  <button
                    onClick={() => setEmitirNfOpen(true)}
                    className="flex items-center gap-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    Emitir nova NF
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEmitirNfOpen(true)}
                  disabled={emittingNf}
                  className="flex items-center gap-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  {emittingNf ? "Solicitando..." : "Emitir NF"}
                </button>
              )}
```

- [ ] **Step 5: Add EmitirNfDialog to dialogs section**

Find the dialogs section (lines 558-576). After the `<PixComprovanteDialog ... />` closing tag (line 576), add:

```jsx
      <EmitirNfDialog
        open={emitirNfOpen}
        onOpenChange={setEmitirNfOpen}
        cobranca={cobranca}
        onEmitir={(cobrancaId, comBoleto) => handleEmitirNf(cobrancaId, comBoleto)}
      />
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "cobrancas/\[id\]/page" || echo "No new errors"`
Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/cobrancas/[id]/page.tsx"
git commit -m "feat(frontend): add NF status badge and EmitirNf integration to charge detail"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|---------------|
| 1 | Invoice fields on Cobranca type | — | `lib/types/index.ts` |
| 2 | Expose invoice fields in charges API | — | `app/api/charges/route.ts` |
| 3 | ERP config CRUD API route | `app/api/erp-config/route.ts` | — |
| 4 | Omie config dialog | `components/configuracoes/omie-config-dialog.tsx` | — |
| 5 | ERP config section component | `components/configuracoes/erp-config-section.tsx` | — |
| 6 | Add ERP section to Integrações tab | — | `app/(dashboard)/configuracoes/page.tsx` |
| 7 | NF status + EmitirNf on charge detail | — | `app/(dashboard)/cobrancas/[id]/page.tsx` |
