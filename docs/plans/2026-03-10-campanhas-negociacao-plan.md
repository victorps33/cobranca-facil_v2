# Campanhas de Negociacao - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Campanhas de Negociação" tab to the réguas page with temporay negotiation campaigns that combine timeline steps + commercial terms.

**Architecture:** New Prisma models (NegotiationCampaign, NegotiationCampaignStep, NegotiationCampaignCustomer) + CRUD API routes + tab-based UI reusing existing timeline components.

**Tech Stack:** Next.js 14, Prisma, PostgreSQL, Tailwind, shadcn/ui, lucide-react

---

### Task 1: Prisma Schema — Add Campaign Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add CampaignStatus enum and models**

Add after the existing `DunningStep` model:

```prisma
enum CampaignStatus {
  DRAFT
  ACTIVE
  ENDED
}

model NegotiationCampaign {
  id                   String                       @id @default(cuid())
  name                 String
  description          String?
  status               CampaignStatus               @default(DRAFT)
  startDate            DateTime
  endDate              DateTime
  maxCashDiscount      Float                        @default(0.10)
  maxInstallments      Int                          @default(6)
  monthlyInterestRate  Float                        @default(0.02)
  minInstallmentCents  Int                          @default(5000)
  targetFilters        Json?
  franqueadoraId       String?
  franqueadora         Franqueadora?                @relation(fields: [franqueadoraId], references: [id])
  createdAt            DateTime                     @default(now())
  steps                NegotiationCampaignStep[]
  customers            NegotiationCampaignCustomer[]

  @@index([franqueadoraId])
  @@index([status])
}

model NegotiationCampaignStep {
  id          String              @id @default(cuid())
  campaignId  String
  campaign    NegotiationCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  trigger     DunningTrigger
  offsetDays  Int                 @default(0)
  channel     Channel
  template    String
  enabled     Boolean             @default(true)
  createdAt   DateTime            @default(now())

  @@index([campaignId])
}

model NegotiationCampaignCustomer {
  id          String              @id @default(cuid())
  campaignId  String
  campaign    NegotiationCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  customerId  String
  customer    Customer            @relation(fields: [customerId], references: [id])
  addedAt     DateTime            @default(now())

  @@unique([campaignId, customerId])
  @@index([campaignId])
  @@index([customerId])
}
```

Also add to the `Franqueadora` model relations:
```prisma
negotiationCampaigns NegotiationCampaign[]
```

And add to the `Customer` model relations:
```prisma
negotiationCampaigns NegotiationCampaignCustomer[]
```

**Step 2: Generate migration and client**

Run:
```bash
npx prisma migrate dev --name add_negotiation_campaigns
npx prisma generate
```

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add NegotiationCampaign schema models and migration"
```

---

### Task 2: API — Campaign CRUD Routes

**Files:**
- Create: `app/api/negotiation-campaigns/route.ts`
- Create: `app/api/negotiation-campaigns/[id]/route.ts`

**Step 1: Create list + create route**

File: `app/api/negotiation-campaigns/route.ts`

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";
import { requireRole } from "@/lib/auth-helpers";
import { headers } from "next/headers";

export async function GET() {
  const headerList = headers();
  const requestedId = headerList.get("x-franqueadora-id") || null;
  const { tenantIds, error } = await requireTenantOrGroup(
    requestedId === "all" ? null : requestedId
  );
  if (error) return error;

  const campaigns = await prisma.negotiationCampaign.findMany({
    where: { franqueadoraId: { in: tenantIds } },
    include: {
      steps: { orderBy: [{ trigger: "asc" }, { offsetDays: "asc" }] },
      _count: { select: { customers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const headerList = headers();
  const requestedId = headerList.get("x-franqueadora-id") || null;
  const { tenantIds, error } = await requireTenantOrGroup(
    requestedId === "all" ? null : requestedId
  );
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const body = await req.json();
  const campaign = await prisma.negotiationCampaign.create({
    data: {
      name: body.name,
      description: body.description || null,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      maxCashDiscount: body.maxCashDiscount ?? 0.10,
      maxInstallments: body.maxInstallments ?? 6,
      monthlyInterestRate: body.monthlyInterestRate ?? 0.02,
      minInstallmentCents: body.minInstallmentCents ?? 5000,
      targetFilters: body.targetFilters || null,
      franqueadoraId: tenantIds[0],
    },
    include: { steps: true },
  });

  return NextResponse.json(campaign, { status: 201 });
}
```

**Step 2: Create detail + update + delete route**

File: `app/api/negotiation-campaigns/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const campaign = await prisma.negotiationCampaign.findFirst({
    where: { id: params.id, franqueadoraId: tenantId! },
    include: {
      steps: { orderBy: [{ trigger: "asc" }, { offsetDays: "asc" }] },
      customers: { include: { customer: { select: { id: true, name: true } } } },
      _count: { select: { customers: true } },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const existing = await prisma.negotiationCampaign.findFirst({
    where: { id: params.id, franqueadoraId: tenantId! },
  });
  if (!existing) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.status !== undefined) data.status = body.status;
  if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
  if (body.endDate !== undefined) data.endDate = new Date(body.endDate);
  if (body.maxCashDiscount !== undefined) data.maxCashDiscount = body.maxCashDiscount;
  if (body.maxInstallments !== undefined) data.maxInstallments = body.maxInstallments;
  if (body.monthlyInterestRate !== undefined) data.monthlyInterestRate = body.monthlyInterestRate;
  if (body.minInstallmentCents !== undefined) data.minInstallmentCents = body.minInstallmentCents;
  if (body.targetFilters !== undefined) data.targetFilters = body.targetFilters;

  const campaign = await prisma.negotiationCampaign.update({
    where: { id: params.id },
    data,
    include: { steps: true, _count: { select: { customers: true } } },
  });

  return NextResponse.json(campaign);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const existing = await prisma.negotiationCampaign.findFirst({
    where: { id: params.id, franqueadoraId: tenantId! },
  });
  if (!existing) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Só é possível excluir campanhas em rascunho" }, { status: 400 });
  }

  await prisma.negotiationCampaign.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 4: Commit**

```bash
git add app/api/negotiation-campaigns/
git commit -m "feat: add negotiation campaigns CRUD API routes"
```

---

### Task 3: API — Campaign Customer Management

**Files:**
- Create: `app/api/negotiation-campaigns/[id]/customers/route.ts`

**Step 1: Create customer add/remove route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const campaign = await prisma.negotiationCampaign.findFirst({
    where: { id: params.id, franqueadoraId: tenantId! },
  });
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

  const body = await req.json();
  const customerIds: string[] = body.customerIds || [];

  const created = await prisma.negotiationCampaignCustomer.createMany({
    data: customerIds.map((customerId) => ({
      campaignId: params.id,
      customerId,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ added: created.count });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const campaign = await prisma.negotiationCampaign.findFirst({
    where: { id: params.id, franqueadoraId: tenantId! },
  });
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

  const body = await req.json();
  const customerIds: string[] = body.customerIds || [];

  await prisma.negotiationCampaignCustomer.deleteMany({
    where: { campaignId: params.id, customerId: { in: customerIds } },
  });

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add app/api/negotiation-campaigns/
git commit -m "feat: add campaign customer management endpoints"
```

---

### Task 4: UI — Add Tabs to Réguas Page

**Files:**
- Modify: `app/(dashboard)/reguas/page.tsx`

This task adds the tab navigation without changing any existing régua code. The current page content becomes the "Réguas Padrão" tab. The "Campanhas" tab shows a placeholder initially.

**Step 1: Add tab state and navigation**

Add a `activeSection` state at the top of `ReguasPage`:

```typescript
const [activeSection, setActiveSection] = useState<"reguas" | "campanhas">("reguas");
```

Wrap the existing content in a conditional and add tab navigation after `<PageHeader>`:

```tsx
<PageHeader title="Réguas de Cobrança" />

{/* Section tabs */}
<div className="border-b border-gray-200">
  <nav className="flex gap-0" aria-label="Seções">
    {[
      { key: "reguas" as const, label: "Réguas Padrão" },
      { key: "campanhas" as const, label: "Campanhas" },
    ].map((tab) => (
      <button
        key={tab.key}
        onClick={() => setActiveSection(tab.key)}
        className={cn(
          "relative px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap",
          activeSection === tab.key
            ? "text-gray-900"
            : "text-gray-400 hover:text-gray-600"
        )}
      >
        {tab.label}
        {activeSection === tab.key && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
        )}
      </button>
    ))}
  </nav>
</div>

{activeSection === "reguas" ? (
  <>
    {/* existing RISK_PROFILES.map(...) cards */}
  </>
) : (
  <CampaignsSection />
)}
```

**Step 2: Create a placeholder CampaignsSection component**

Add at the bottom of the file, before the fullscreen modal:

```tsx
function CampaignsSection() {
  return (
    <FilterEmptyState
      message="Nenhuma campanha de negociação criada."
      suggestion="Crie uma campanha para oferecer condições especiais de renegociação."
      actionLabel="Criar campanha"
      actionHref="/reguas/campanhas/nova"
    />
  );
}
```

**Step 3: Verify it renders**

Run: dev server, navigate to `/reguas`, confirm both tabs work. "Réguas Padrão" shows existing cards, "Campanhas" shows empty state.

**Step 4: Commit**

```bash
git add app/(dashboard)/reguas/page.tsx
git commit -m "feat: add section tabs to réguas page with campaigns placeholder"
```

---

### Task 5: UI — Campaign Cards

**Files:**
- Modify: `app/(dashboard)/reguas/page.tsx`

**Step 1: Add campaign types**

Add alongside existing types:

```typescript
type CampaignStatus = "DRAFT" | "ACTIVE" | "ENDED";

interface ApiCampaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  maxCashDiscount: number;
  maxInstallments: number;
  monthlyInterestRate: number;
  minInstallmentCents: number;
  targetFilters: Record<string, unknown> | null;
  steps: ApiDunningStep[];
  _count: { customers: number };
}

const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; className: string }> = {
  DRAFT: { label: "Rascunho", className: "bg-gray-100 text-gray-600" },
  ACTIVE: { label: "Ativa", className: "bg-emerald-50 text-emerald-700" },
  ENDED: { label: "Encerrada", className: "bg-gray-100 text-gray-400" },
};
```

**Step 2: Build CampaignsSection with data fetching + cards**

Replace the placeholder `CampaignsSection` with full implementation:

```tsx
function CampaignsSection() {
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullscreenRule, setFullscreenRule] = useState<ApiCampaign | null>(null);

  useEffect(() => {
    const headers = getFranqueadoraHeaders();
    fetch("/api/negotiation-campaigns", { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setCampaigns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <FilterEmptyState
        message="Nenhuma campanha de negociação criada."
        suggestion="Crie uma campanha para oferecer condições especiais de renegociação."
        actionLabel="Criar campanha"
        actionHref="/reguas/campanhas/nova"
      />
    );
  }

  return (
    <div className="space-y-5">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}
```

**Step 3: Build CampaignCard component**

Reuses existing timeline components (`toTimelineSteps`, `TimelineView`, `ScrollFadeContainer`):

```tsx
function CampaignCard({ campaign }: { campaign: ApiCampaign }) {
  const sorted = toTimelineSteps(campaign.steps);
  const d0Index = sorted.findIndex((s) => s.days === 0);
  const status = CAMPAIGN_STATUS[campaign.status];
  const start = new Date(campaign.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const end = new Date(campaign.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  return (
    <div
      className={cn(
        "group/card rounded-2xl border border-gray-100 bg-white transition-colors duration-200 overflow-hidden hover:border-gray-200 min-w-0",
        campaign.status === "ENDED" && "opacity-60"
      )}
      style={{ animation: "regua-card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{campaign.name}</h3>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", status.className)}>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {start} — {end} · {campaign._count.customers} clientes · {campaign.steps.length} etapas
          </p>
        </div>
        <Link
          href={`/reguas/campanhas/${campaign.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Link>
      </div>

      {/* Commercial terms */}
      <div className="px-6 pb-3 flex gap-4 text-[11px] text-gray-400">
        <span>Desconto até {(campaign.maxCashDiscount * 100).toFixed(0)}%</span>
        <span>·</span>
        <span>Até {campaign.maxInstallments}x</span>
        <span>·</span>
        <span>Juros {(campaign.monthlyInterestRate * 100).toFixed(1)}% a.m.</span>
      </div>

      {/* Timeline */}
      {sorted.length > 0 && (
        <div className="border-t border-gray-50">
          <ScrollFadeContainer className="px-4 py-4">
            <TimelineView sorted={sorted} d0Index={d0Index} size="compact" />
          </ScrollFadeContainer>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Verify rendering**

Dev server → `/reguas` → tab "Campanhas" → should show empty state (no campaigns yet) or campaign cards if API returns data.

**Step 5: Commit**

```bash
git add app/(dashboard)/reguas/page.tsx
git commit -m "feat: add campaign cards with timeline and commercial terms display"
```

---

### Task 6: Build & Deploy

**Step 1: Verify full build**

```bash
npx next build
```

Expected: Compiled successfully, no type errors.

**Step 2: Commit any remaining changes and push**

```bash
git push origin main
```

**Step 3: Verify deployment on menlocobranca.vercel.app**

Navigate to `/reguas`, confirm tabs work, empty state shows on Campanhas tab.

---

## Future Tasks (out of scope for this plan)

- Campaign create/edit page (`/reguas/campanhas/nova` and `/reguas/campanhas/[id]`)
- Customer selection UI (manual + filters)
- Campaign auto-end cron job
- Agent AI integration with active campaign conditions
