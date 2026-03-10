# Segmentação de Clientes por Régua - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an expandable client segmentation table (phase × competência) inside each régua card, with inline customer list drill-down.

**Architecture:** New API endpoint computes segmentation by querying charges of customers with matching risk profile, grouping by dunning phase and competência. UI adds a collapsible table to RuleCard with clickable cells that expand to show customer names.

**Tech Stack:** Next.js 14, Prisma, PostgreSQL, Tailwind, React

---

### Task 1: API — Segmentation Endpoint

**Files:**
- Create: `app/api/dunning-rules/[id]/segmentation/route.ts`

**Step 1: Create the segmentation endpoint**

This endpoint fetches charges for customers matching the rule's risk profile, determines which dunning phase each charge is in based on days overdue and the rule's steps, then groups by phase × competência.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { differenceInDays } from "date-fns";

const PHASE_ORDER = [
  "LEMBRETE",
  "VENCIMENTO",
  "ATRASO",
  "NEGATIVACAO",
  "COBRANCA_INTENSIVA",
  "PROTESTO",
  "POS_PROTESTO",
] as const;

function getPhaseIndex(phase: string): number {
  return PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, tenantId } = await requireTenant();
  if (error) return error;

  // 1. Fetch the rule with its steps
  const rule = await prisma.dunningRule.findFirst({
    where: { id: params.id, franqueadoraId: tenantId! },
    include: {
      steps: {
        where: { enabled: true },
        orderBy: [{ trigger: "asc" }, { offsetDays: "asc" }],
      },
    },
  });

  if (!rule) {
    return NextResponse.json({ error: "Régua não encontrada" }, { status: 404 });
  }

  // 2. Build phase thresholds from steps
  // Each step has a phase and offset days. We collect the max offset for each phase.
  const maxPhaseIdx = getPhaseIndex(rule.maxPhase);
  const activePhases = PHASE_ORDER.filter((_, i) => i <= maxPhaseIdx);

  // Map each step to its absolute day offset (negative for BEFORE_DUE, 0 for ON_DUE, positive for AFTER_DUE)
  const stepDays = rule.steps.map((s) => ({
    phase: s.phase,
    days:
      s.trigger === "BEFORE_DUE"
        ? -s.offsetDays
        : s.trigger === "ON_DUE"
          ? 0
          : s.offsetDays,
  }));

  // Build sorted phase boundaries: for each phase, the minimum day that starts it
  const phaseBoundaries: { phase: string; startDay: number }[] = [];
  for (const phase of activePhases) {
    const phaseSteps = stepDays.filter((s) => s.phase === phase);
    if (phaseSteps.length > 0) {
      phaseBoundaries.push({
        phase,
        startDay: Math.min(...phaseSteps.map((s) => s.days)),
      });
    }
  }
  // Sort by startDay ascending
  phaseBoundaries.sort((a, b) => a.startDay - b.startDay);

  // 3. Fetch customers with matching risk profile
  const customers = await prisma.customer.findMany({
    where: {
      franqueadoraId: tenantId!,
      riskScore: { riskProfile: rule.riskProfile },
    },
    select: { id: true, name: true },
  });

  if (customers.length === 0) {
    return NextResponse.json({
      phases: activePhases,
      competencias: [],
      matrix: {},
      totalsByPhase: {},
      totalsByCompetencia: {},
    });
  }

  const customerMap = new Map(customers.map((c) => [c.id, c.name]));
  const customerIds = customers.map((c) => c.id);

  // 4. Fetch non-paid charges for these customers
  const charges = await prisma.charge.findMany({
    where: {
      customerId: { in: customerIds },
      status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
      competencia: { not: null },
    },
    select: {
      id: true,
      customerId: true,
      dueDate: true,
      competencia: true,
    },
  });

  // 5. Determine phase for each charge based on days overdue
  const now = new Date();

  function determinePhase(daysOverdue: number): string {
    if (phaseBoundaries.length === 0) return activePhases[0] || "LEMBRETE";
    // Find the last boundary whose startDay <= daysOverdue
    let matched = phaseBoundaries[0].phase;
    for (const b of phaseBoundaries) {
      if (daysOverdue >= b.startDay) {
        matched = b.phase;
      } else {
        break;
      }
    }
    return matched;
  }

  // 6. Build matrix
  type CellData = { count: number; customers: { id: string; name: string }[] };
  const matrix: Record<string, Record<string, CellData>> = {};
  const totalsByPhase: Record<string, number> = {};
  const totalsByCompetencia: Record<string, number> = {};
  const competenciasSet = new Set<string>();

  for (const charge of charges) {
    const daysOverdue = differenceInDays(now, new Date(charge.dueDate));
    const phase = determinePhase(daysOverdue);
    const comp = charge.competencia!;
    competenciasSet.add(comp);

    if (!matrix[phase]) matrix[phase] = {};
    if (!matrix[phase][comp]) matrix[phase][comp] = { count: 0, customers: [] };

    // Avoid duplicate customers in the same cell
    const cell = matrix[phase][comp];
    if (!cell.customers.some((c) => c.id === charge.customerId)) {
      cell.customers.push({
        id: charge.customerId,
        name: customerMap.get(charge.customerId) || "—",
      });
    }
    cell.count = cell.customers.length;

    totalsByPhase[phase] = (totalsByPhase[phase] || 0);
    totalsByCompetencia[comp] = (totalsByCompetencia[comp] || 0);
  }

  // Recount totals from unique customers per cell
  for (const phase of Object.keys(matrix)) {
    let phaseTotal = 0;
    for (const comp of Object.keys(matrix[phase])) {
      phaseTotal += matrix[phase][comp].count;
    }
    totalsByPhase[phase] = phaseTotal;
  }
  for (const comp of competenciasSet) {
    let compTotal = 0;
    for (const phase of Object.keys(matrix)) {
      compTotal += (matrix[phase]?.[comp]?.count || 0);
    }
    totalsByCompetencia[comp] = compTotal;
  }

  const competencias = Array.from(competenciasSet).sort();

  return NextResponse.json({
    phases: activePhases,
    competencias,
    matrix,
    totalsByPhase,
    totalsByCompetencia,
  });
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add app/api/dunning-rules/[id]/segmentation/
git commit -m "feat: add dunning rule segmentation API endpoint"
```

---

### Task 2: UI — Make "clientes" clickable and add expandable section

**Files:**
- Modify: `app/(dashboard)/reguas/page.tsx`

This task modifies the RuleCard component to:
1. Make the "X clientes" text clickable (toggles segmentation panel)
2. Add a collapsible segmentation section below the timeline
3. Fetch segmentation data on expand

**Step 1: Add segmentation types**

Add near the existing types at the top of the file:

```typescript
interface SegmentationCell {
  count: number;
  customers: { id: string; name: string }[];
}

interface SegmentationData {
  phases: string[];
  competencias: string[];
  matrix: Record<string, Record<string, SegmentationCell>>;
  totalsByPhase: Record<string, number>;
  totalsByCompetencia: Record<string, number>;
}
```

**Step 2: Add segmentation state to RuleCard**

Inside the `RuleCard` component, add state:

```typescript
const [segOpen, setSegOpen] = useState(false);
const [segData, setSegData] = useState<SegmentationData | null>(null);
const [segLoading, setSegLoading] = useState(false);
const [expandedCell, setExpandedCell] = useState<string | null>(null); // "PHASE:COMP"
```

Add a fetch function:

```typescript
const handleToggleSeg = useCallback(() => {
  if (segOpen) {
    setSegOpen(false);
    return;
  }
  setSegOpen(true);
  if (segData) return; // already loaded
  setSegLoading(true);
  fetch(`/api/dunning-rules/${rule.id}/segmentation`, {
    headers: getFranqueadoraHeaders(),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { if (data) setSegData(data); })
    .catch(() => {})
    .finally(() => setSegLoading(false));
}, [segOpen, segData, rule.id]);
```

**Step 3: Make "X clientes" clickable**

In the RuleCard header subtitle line, replace the static text with a clickable button:

Change from:
```tsx
<p className="text-xs text-gray-400 mt-0.5">
  {rule.steps.length} etapas · Até {PHASE_LABELS[rule.maxPhase] || rule.maxPhase} · {customerCount} clientes
</p>
```

To:
```tsx
<p className="text-xs text-gray-400 mt-0.5">
  {rule.steps.length} etapas · Até {PHASE_LABELS[rule.maxPhase] || rule.maxPhase} ·{" "}
  <button
    onClick={handleToggleSeg}
    className="text-gray-500 hover:text-gray-700 underline decoration-dotted underline-offset-2 transition-colors"
  >
    {customerCount} clientes
  </button>
</p>
```

**Step 4: Add the segmentation table section**

Add this after the timeline section (the `border-t border-gray-50` div) inside the RuleCard, before the closing `</div>`:

```tsx
{/* Segmentation */}
{segOpen && (
  <div className="border-t border-gray-100 px-6 py-4">
    {segLoading ? (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    ) : segData && segData.competencias.length > 0 ? (
      <SegmentationTable
        data={segData}
        expandedCell={expandedCell}
        onToggleCell={(key) => setExpandedCell(expandedCell === key ? null : key)}
      />
    ) : (
      <p className="text-xs text-gray-400 text-center py-4">
        Nenhuma cobrança encontrada para segmentação.
      </p>
    )}
  </div>
)}
```

**Step 5: Add Loader2 to imports**

Add `Loader2` to the lucide-react import if not already present:

```typescript
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Phone,
  ShieldAlert,
  FileText,
  Scale,
  Pencil,
  Maximize2,
  X,
  Loader2,
  ChevronDown,
} from "lucide-react";
```

**Step 6: Commit**

```bash
git add app/(dashboard)/reguas/page.tsx
git commit -m "feat: add expandable segmentation trigger to régua cards"
```

---

### Task 3: UI — SegmentationTable Component

**Files:**
- Modify: `app/(dashboard)/reguas/page.tsx`

Add the `SegmentationTable` component at the bottom of the file (before `FullscreenTimeline`). This renders the phase × competência matrix with clickable cells that expand to show customer names.

**Step 1: Add the SegmentationTable component**

```tsx
function SegmentationTable({
  data,
  expandedCell,
  onToggleCell,
}: {
  data: SegmentationData;
  expandedCell: string | null;
  onToggleCell: (key: string) => void;
}) {
  const { phases, competencias, matrix, totalsByPhase, totalsByCompetencia } = data;

  // Format competencia for display: "2026-01" → "Jan/26"
  function formatComp(comp: string): string {
    const [year, month] = comp.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(month, 10) - 1]}/${year.slice(2)}`;
  }

  const grandTotal = Object.values(totalsByCompetencia).reduce((a, b) => a + b, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 pr-4 text-gray-500 font-medium">Fase</th>
            {competencias.map((comp) => (
              <th key={comp} className="text-center py-2 px-3 text-gray-500 font-medium">
                {formatComp(comp)}
              </th>
            ))}
            <th className="text-center py-2 pl-3 text-gray-500 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {phases.map((phase) => {
            const phaseLabel = PHASE_LABELS[phase] || phase;
            return (
              <SegmentationRow
                key={phase}
                phase={phase}
                phaseLabel={phaseLabel}
                competencias={competencias}
                cells={matrix[phase] || {}}
                total={totalsByPhase[phase] || 0}
                expandedCell={expandedCell}
                onToggleCell={onToggleCell}
              />
            );
          })}
          {/* Totals row */}
          <tr className="border-t border-gray-200">
            <td className="py-2 pr-4 text-gray-500 font-semibold">Total</td>
            {competencias.map((comp) => (
              <td key={comp} className="text-center py-2 px-3 text-gray-500 font-semibold tabular-nums">
                {totalsByCompetencia[comp] || 0}
              </td>
            ))}
            <td className="text-center py-2 pl-3 text-gray-900 font-semibold tabular-nums">
              {grandTotal}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Add the SegmentationRow component**

This handles rendering a single phase row plus the expanded customer list when a cell is clicked.

```tsx
function SegmentationRow({
  phase,
  phaseLabel,
  competencias,
  cells,
  total,
  expandedCell,
  onToggleCell,
}: {
  phase: string;
  phaseLabel: string;
  competencias: string[];
  cells: Record<string, SegmentationCell>;
  total: number;
  expandedCell: string | null;
  onToggleCell: (key: string) => void;
}) {
  // Check if any cell in this row is expanded
  const expandedComp = competencias.find((comp) => expandedCell === `${phase}:${comp}`);
  const expandedCustomers = expandedComp ? cells[expandedComp]?.customers || [] : [];

  return (
    <>
      <tr className="border-b border-gray-50">
        <td className="py-2 pr-4 text-gray-700 font-medium whitespace-nowrap">{phaseLabel}</td>
        {competencias.map((comp) => {
          const cell = cells[comp];
          const count = cell?.count || 0;
          const key = `${phase}:${comp}`;
          const isExpanded = expandedCell === key;

          return (
            <td key={comp} className="text-center py-2 px-3">
              {count > 0 ? (
                <button
                  onClick={() => onToggleCell(key)}
                  className={cn(
                    "inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-md text-xs tabular-nums transition-colors",
                    isExpanded
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {count}
                </button>
              ) : (
                <span className="text-gray-300">0</span>
              )}
            </td>
          );
        })}
        <td className="text-center py-2 pl-3 text-gray-700 font-semibold tabular-nums">{total}</td>
      </tr>
      {/* Expanded customer list */}
      {expandedComp && expandedCustomers.length > 0 && (
        <tr>
          <td colSpan={competencias.length + 2} className="py-2 px-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-[10px] text-gray-400 font-medium mb-2">
                {phaseLabel} — {expandedComp}
              </p>
              <div className="flex flex-wrap gap-2">
                {expandedCustomers.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-700"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 4: Commit**

```bash
git add app/(dashboard)/reguas/page.tsx
git commit -m "feat: add segmentation table component with inline customer drill-down"
```

---

### Task 4: Build & Deploy

**Step 1: Full build**

```bash
npx next build
```

Expected: Compiled successfully

**Step 2: Push**

```bash
git push origin main
```

**Step 3: Verify on menlocobranca.vercel.app**

Navigate to `/reguas`, click "X clientes" on a régua card, confirm segmentation table appears with phase rows and competência columns.

---

## Future Tasks (out of scope)

- Link customer names to customer detail page
- Add filtering within segmentation table
- Export segmentation data as CSV
