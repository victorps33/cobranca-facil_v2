# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a public landing page with animated product demo, features section, and CTA to schedule demos.

**Architecture:** Single-page static route (`/landing`) bypassing auth middleware. All mockups rendered as HTML/CSS (no external assets). CSS keyframes + IntersectionObserver for scroll-triggered animations.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, Lucide React, IntersectionObserver API

**Spec:** `docs/superpowers/specs/2026-03-12-landing-page-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `middleware.ts` | Add `landing` to public routes regex |
| Modify | `app/globals.css` | Add `crossfade` keyframe + landing animation classes |
| Create | `app/landing/page.tsx` | Landing page (static, server component shell) |
| Create | `app/landing/layout.tsx` | Minimal layout (no dashboard chrome) |
| Create | `components/landing/LandingNavbar.tsx` | Fixed navbar with logo + login link |
| Create | `components/landing/HeroSection.tsx` | Fullscreen hero with background mockup + overlay |
| Create | `components/landing/DemoAnimation.tsx` | Browser frame with animated product screens |
| Create | `components/landing/FeaturesSection.tsx` | 3-column feature cards |
| Create | `components/landing/CTASection.tsx` | Final call-to-action block |

---

## Chunk 1: Route & Layout Infrastructure

### Task 1: Add `/landing` to public routes

**Files:**
- Modify: `middleware.ts:18`

- [ ] **Step 1: Update the matcher regex**

In `middleware.ts` line 18, add `landing|` after the `(?!` in the negative-lookahead:

```typescript
"/((?!api/auth|api/cron|api/inngest|api/webhooks|api/integrations|_next/static|_next/image|favicon\\.ico|auth|landing|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.gif$|.*\\.ico$|.*\\.webp$|.*\\.woff2?$).*)",
```

- [ ] **Step 2: Verify the route is accessible**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next build 2>&1 | tail -20`

Expected: Build succeeds (landing page doesn't exist yet, but middleware change is valid).

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add /landing to public routes in middleware"
```

---

### Task 2: Create landing layout

**Files:**
- Create: `app/landing/layout.tsx`

- [ ] **Step 1: Create the layout file**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Menlo Cobrança — Cobrança automatizada e inteligente",
  description:
    "Crie réguas de cobrança inteligentes, automatize comunicações e acompanhe resultados em tempo real.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-menlo-offwhite">{children}</div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/landing/layout.tsx
git commit -m "feat: add landing page layout with metadata"
```

---

### Task 3: Create landing page shell

**Files:**
- Create: `app/landing/page.tsx`

- [ ] **Step 1: Create the page with placeholder sections**

```tsx
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { DemoAnimation } from "@/components/landing/DemoAnimation";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { CTASection } from "@/components/landing/CTASection";

const DEMO_URL = "#"; // Replace with Calendly or booking URL

export default function LandingPage() {
  return (
    <>
      <LandingNavbar />
      <main>
        <HeroSection demoUrl={DEMO_URL} />
        <DemoAnimation />
        <FeaturesSection />
        <CTASection demoUrl={DEMO_URL} />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Create stub components so the page compiles**

Create all 5 component files in `components/landing/` with minimal stubs:

**`components/landing/LandingNavbar.tsx`:**
```tsx
export function LandingNavbar() {
  return <nav className="h-16">Navbar placeholder</nav>;
}
```

**`components/landing/HeroSection.tsx`:**
```tsx
export function HeroSection({ demoUrl }: { demoUrl: string }) {
  return <section className="min-h-screen">Hero placeholder</section>;
}
```

**`components/landing/DemoAnimation.tsx`:**
```tsx
export function DemoAnimation() {
  return <section>Demo placeholder</section>;
}
```

**`components/landing/FeaturesSection.tsx`:**
```tsx
export function FeaturesSection() {
  return <section>Features placeholder</section>;
}
```

**`components/landing/CTASection.tsx`:**
```tsx
export function CTASection({ demoUrl }: { demoUrl: string }) {
  return <section>CTA placeholder</section>;
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next build 2>&1 | tail -20`

Expected: Build succeeds, `/landing` route listed.

- [ ] **Step 4: Commit**

```bash
git add app/landing/page.tsx components/landing/
git commit -m "feat: scaffold landing page with stub components"
```

---

## Chunk 2: Navbar & Hero

### Task 4: Implement LandingNavbar

**Files:**
- Modify: `components/landing/LandingNavbar.tsx`

- [ ] **Step 1: Implement the navbar**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MenloLogo } from "@/components/brand/MenloLogo";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-menlo-offwhite/95 backdrop-blur-sm shadow-soft" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/landing">
          <MenloLogo variant="default" size="md" />
        </Link>
        <Link
          href="/auth/login"
          className="text-sm font-medium text-gray-600 hover:text-menlo-orange transition-colors"
        >
          Login
        </Link>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify in dev server**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next dev -p 3001 &`

Open `http://localhost:3001/landing` — navbar should render with logo and Login link. Scroll to verify background transition.

- [ ] **Step 3: Commit**

```bash
git add components/landing/LandingNavbar.tsx
git commit -m "feat: implement landing navbar with scroll background"
```

---

### Task 5: Implement HeroSection

**Files:**
- Modify: `components/landing/HeroSection.tsx`

- [ ] **Step 1: Implement the hero with background mockup and overlay**

```tsx
"use client";

import Link from "next/link";

export function HeroSection({ demoUrl }: { demoUrl: string }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background: static dashboard mockup */}
      <div className="absolute inset-0 opacity-[0.15] pointer-events-none">
        <DashboardMockup />
      </div>

      {/* Overlay gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(245,245,240,0.85) 0%, rgba(245,245,240,0.95) 50%, rgba(245,245,240,1) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
        <p className="text-xs uppercase tracking-[2px] font-semibold text-menlo-orange mb-4">
          Menlo Cobrança
        </p>
        <h1 className="text-3xl md:text-5xl font-bold text-menlo-black leading-tight mb-4">
          Recupere receita com cobrança automatizada
        </h1>
        <p className="text-gray-500 text-base md:text-lg mb-8 max-w-xl mx-auto">
          Crie réguas de cobrança inteligentes, automatize comunicações e
          acompanhe resultados em tempo real.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a
            href={demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-menlo-orange text-white px-7 py-3 rounded-xl font-semibold text-sm hover:bg-menlo-orange-dark transition-colors"
          >
            Agendar Demo
          </a>
          <button
            onClick={() =>
              document
                .getElementById("demo")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="bg-white text-menlo-black px-7 py-3 rounded-xl font-semibold text-sm border border-gray-200 hover:border-gray-300 transition-colors"
          >
            Ver em ação ↓
          </button>
        </div>
      </div>
    </section>
  );
}

/** Static HTML/CSS mockup of the dashboard used as hero background */
function DashboardMockup() {
  return (
    <div className="w-full h-full flex items-center justify-center p-12 lg:p-24">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[500px] p-4 shadow-soft">
        {/* Browser dots */}
        <div className="flex gap-1.5 mb-4">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex gap-3 h-[calc(100%-28px)]">
          {/* Sidebar */}
          <div className="w-12 bg-gray-50 rounded-lg" />
          {/* Content */}
          <div className="flex-1 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 bg-gray-50 rounded-lg h-16" />
              <div className="flex-1 bg-gray-50 rounded-lg h-16" />
              <div className="flex-1 bg-gray-50 rounded-lg h-16" />
            </div>
            <div className="bg-gray-50 rounded-lg flex-1 h-48" />
            <div className="bg-gray-50 rounded-lg h-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3001/landing` — hero should show fullscreen with faded dashboard background, title, subtitle, and two CTAs. "Ver em ação ↓" scrolls down.

- [ ] **Step 3: Commit**

```bash
git add components/landing/HeroSection.tsx
git commit -m "feat: implement hero section with dashboard mockup background"
```

---

## Chunk 3: Demo Animation

### Task 6: Add crossfade keyframe to globals.css

**Files:**
- Modify: `app/globals.css` (after line 466, before stagger delays)

- [ ] **Step 1: Add the crossfade keyframe and landing animation classes**

Add after the existing `slideInRight` keyframe block, before the `/* Stagger delays */` comment:

```css
@keyframes crossfade {
  0%, 30% { opacity: 1; }
  33.33%, 96.66% { opacity: 0; }
  100% { opacity: 1; }
}

/* Landing page demo animation */
.landing-screen {
  animation: crossfade 9s infinite;
}
.landing-screen:nth-child(2) {
  animation-delay: -3s;
}
.landing-screen:nth-child(3) {
  animation-delay: -6s;
}
```

This creates a 3-phase crossfade: each screen visible for 3s out of a 9s cycle.

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: add crossfade keyframe for landing demo animation"
```

---

### Task 7: Implement DemoAnimation

**Files:**
- Modify: `components/landing/DemoAnimation.tsx`

- [ ] **Step 1: Implement the browser frame with 3 animated screens**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

export function DemoAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [activeScreen, setActiveScreen] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Sync dot indicator with CSS animation cycle (3s per screen, 9s total)
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setActiveScreen((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, [visible]);

  return (
    <section id="demo" className="bg-menlo-offwhite px-6 py-16 md:py-24">
      <div
        ref={ref}
        className={`max-w-4xl mx-auto transition-all duration-700 ${
          visible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-6"
        }`}
      >
        {/* Browser frame */}
        <div className="rounded-2xl shadow-large overflow-hidden bg-white">
          {/* Chrome bar */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 ml-3 bg-gray-100 rounded-md h-7 flex items-center px-3">
              <span className="text-xs text-gray-400">
                app.menlocobranca.com.br
              </span>
            </div>
          </div>

          {/* Screen area */}
          <div className="relative h-[300px] md:h-[420px] overflow-hidden">
            {visible && (
              <>
                <div className="landing-screen absolute inset-0 p-6 md:p-8">
                  <ScreenNovaCobranca />
                </div>
                <div className="landing-screen absolute inset-0 p-6 md:p-8">
                  <ScreenReguaAtiva />
                </div>
                <div className="landing-screen absolute inset-0 p-6 md:p-8">
                  <ScreenResultado />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {["Nova Cobrança", "Régua Ativa", "Resultado"].map((label, i) => (
            <button
              key={label}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === activeScreen
                  ? "w-6 bg-menlo-orange"
                  : "w-2 bg-gray-300"
              }`}
              aria-label={label}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Screen Mockups ─── */

function ScreenNovaCobranca() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-menlo-orange" />
        <span className="text-xs font-semibold text-menlo-orange uppercase tracking-wide">
          Etapa 1
        </span>
      </div>
      <h3 className="text-lg md:text-xl font-bold text-menlo-black mb-1">
        Nova Cobrança
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        Crie uma cobrança em segundos
      </p>
      <div className="space-y-3 max-w-md">
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="text-[10px] text-gray-400 mb-1">Cliente</div>
            <div className="h-9 bg-gray-50 rounded-lg border border-gray-200 flex items-center px-3">
              <span className="text-xs text-gray-500">Franquia Centro SP</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-gray-400 mb-1">Valor</div>
            <div className="h-9 bg-gray-50 rounded-lg border border-gray-200 flex items-center px-3">
              <span className="text-xs text-gray-500">R$ 2.450,00</span>
            </div>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400 mb-1">Vencimento</div>
          <div className="h-9 bg-gray-50 rounded-lg border border-gray-200 flex items-center px-3">
            <span className="text-xs text-gray-500">15/03/2026</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400 mb-1">Régua de Cobrança</div>
          <div className="h-9 bg-orange-50 rounded-lg border border-orange-200 flex items-center px-3">
            <span className="text-xs text-menlo-orange font-medium">
              Régua Padrão — 3 etapas
            </span>
          </div>
        </div>
        <button className="bg-menlo-orange text-white text-xs font-semibold px-5 py-2.5 rounded-lg mt-2">
          Criar Cobrança
        </button>
      </div>
    </div>
  );
}

function ScreenReguaAtiva() {
  const steps = [
    { label: "Lembrete", desc: "3 dias antes", status: "done" },
    { label: "Notificação", desc: "No vencimento", status: "active" },
    { label: "Escalação", desc: "7 dias após", status: "pending" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-menlo-orange" />
        <span className="text-xs font-semibold text-menlo-orange uppercase tracking-wide">
          Etapa 2
        </span>
      </div>
      <h3 className="text-lg md:text-xl font-bold text-menlo-black mb-1">
        Régua Ativa
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        Acompanhe cada etapa da cobrança
      </p>
      <div className="space-y-4 max-w-md">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step.status === "done"
                  ? "bg-green-100 text-green-600"
                  : step.status === "active"
                    ? "bg-orange-100 text-menlo-orange ring-2 ring-menlo-orange/30"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {step.status === "done" ? "✓" : step.status === "active" ? "●" : "○"}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-menlo-black">
                {step.label}
              </div>
              <div className="text-xs text-gray-400">{step.desc}</div>
            </div>
            {step.status === "active" && (
              <span className="text-[10px] bg-orange-50 text-menlo-orange px-2 py-0.5 rounded-full font-medium">
                Em andamento
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenResultado() {
  const metrics = [
    { label: "Receita Recuperada", value: "R$ 47.200", trend: "+23%" },
    { label: "Taxa de Sucesso", value: "78%", trend: "+5%" },
    { label: "Tempo Médio", value: "4.2 dias", trend: "-18%" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-menlo-orange" />
        <span className="text-xs font-semibold text-menlo-orange uppercase tracking-wide">
          Etapa 3
        </span>
      </div>
      <h3 className="text-lg md:text-xl font-bold text-menlo-black mb-1">
        Resultado
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        Acompanhe a recuperação em tempo real
      </p>
      <div className="grid grid-cols-3 gap-3 max-w-lg">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-gray-50 rounded-xl p-4 border border-gray-100"
          >
            <div className="text-[10px] text-gray-400 mb-2">{m.label}</div>
            <div className="text-lg md:text-xl font-bold text-menlo-black">
              {m.value}
            </div>
            <div
              className={`text-xs font-medium mt-1 ${
                m.trend.startsWith("+") ? "text-green-500" : "text-blue-500"
              }`}
            >
              {m.trend}
            </div>
          </div>
        ))}
      </div>
      {/* Mini chart placeholder */}
      <div className="mt-4 max-w-lg h-20 bg-gray-50 rounded-xl border border-gray-100 flex items-end px-4 pb-2 gap-1">
        {[40, 55, 35, 65, 50, 70, 60, 80, 75, 90, 85, 95].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-menlo-orange/20 rounded-t"
            style={{ height: `${h}%` }}
          >
            <div
              className="w-full bg-menlo-orange rounded-t"
              style={{ height: "40%" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3001/landing` and scroll to the demo section. The browser frame should appear with a fade-in, then cycle through 3 screens every 3 seconds. Dot indicators should sync.

- [ ] **Step 3: Commit**

```bash
git add components/landing/DemoAnimation.tsx
git commit -m "feat: implement animated product demo with 3-screen crossfade"
```

---

## Chunk 4: Features, CTA & Final Polish

### Task 8: Implement FeaturesSection

**Files:**
- Modify: `components/landing/FeaturesSection.tsx`

- [ ] **Step 1: Implement the 3-column features**

```tsx
import { Zap, Brain, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Réguas Inteligentes",
    description: "Automatize o fluxo de cobrança do início ao fim",
    color: "bg-orange-50 text-menlo-orange",
  },
  {
    icon: Brain,
    title: "IA Integrada",
    description: "Julia analisa padrões e sugere as melhores ações",
    color: "bg-blue-50 text-blue-500",
  },
  {
    icon: TrendingUp,
    title: "Resultados Reais",
    description: "Acompanhe recuperação de receita em tempo real",
    color: "bg-green-50 text-green-500",
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-white py-16 md:py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-menlo-black text-center mb-12">
          Por que escolher a Menlo?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title} className="text-center">
              <div
                className={`w-12 h-12 rounded-xl ${f.color} mx-auto mb-4 flex items-center justify-center`}
              >
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-menlo-black mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-gray-500">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/FeaturesSection.tsx
git commit -m "feat: implement features section with 3 cards"
```

---

### Task 9: Implement CTASection

**Files:**
- Modify: `components/landing/CTASection.tsx`

- [ ] **Step 1: Implement the final CTA**

```tsx
export function CTASection({ demoUrl }: { demoUrl: string }) {
  return (
    <section className="bg-menlo-offwhite py-16 md:py-24 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-menlo-black mb-3">
          Pronto pra recuperar receita?
        </h2>
        <p className="text-gray-500 mb-8">
          Agende uma demo e veja como a Menlo funciona pro seu negócio
        </p>
        <a
          href={demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-menlo-orange text-white px-8 py-3.5 rounded-xl font-semibold text-sm hover:bg-menlo-orange-dark transition-colors"
        >
          Agendar Demo Gratuita
        </a>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/CTASection.tsx
git commit -m "feat: implement final CTA section"
```

---

### Task 10: Final build verification

- [ ] **Step 1: Run full build**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next build 2>&1 | tail -30`

Expected: Build succeeds, `/landing` appears in route list.

- [ ] **Step 2: Test in dev server**

Run: `cd /Users/victorsundfeld/cobranca-facil_v2 && npx next dev -p 3001`

Manual checklist:
1. `http://localhost:3001/landing` loads without auth redirect
2. Navbar shows logo + Login link, background changes on scroll
3. Hero shows dashboard mockup behind overlay, two CTAs visible
4. "Ver em ação ↓" scrolls smoothly to demo section
5. Demo animation triggers on scroll, cycles through 3 screens
6. Dot indicators sync with active screen
7. Features section shows 3 cards with icons
8. CTA section has "Agendar Demo Gratuita" button
9. Mobile: all sections stack properly at 375px width

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: landing page polish and responsive adjustments"
```
