# Menlo Design System — Spec

**Data**: 2026-03-20
**Projeto**: cobranca-facil_v2 (menlocobranca.vercel.app)
**Objetivo**: Formalizar e documentar o design system existente com documentação escrita (MDX) + catálogo visual interativo (Storybook)
**Público-alvo**: Devs, designers e stakeholders não-técnicos
**Escopo**: Light mode only (dark mode em fase posterior)

---

## 1. Estrutura e Setup

### Framework
- Storybook 8 com `@storybook/nextjs` (suporte nativo a Next.js App Router, Tailwind, CSS custom properties)

### Estrutura de pastas
```
.storybook/
  main.ts          # config: framework, addons, stories glob
  preview.ts       # importa globals.css, configura tema Menlo
  theme.ts         # tema custom do Storybook (logo Menlo, cores brand)

stories/
  foundations/      # MDX docs pages
    Colors.mdx
    Typography.mdx
    Spacing.mdx
    Shadows.mdx
    BorderRadius.mdx
    Icons.mdx
  components/       # stories dos 35 componentes
    Button.stories.tsx
    Badge.stories.tsx
    Card.stories.tsx
    ...
```

### Addons
- `@storybook/addon-essentials` (Controls, Actions, Docs, Viewport)
- `@storybook/addon-a11y` (auditoria de acessibilidade)
- `@storybook/addon-themes` (futuro dark mode)

### Autodocs
Habilitado globalmente — cada componente com `argTypes` gera docs de props automáticos.

---

## 2. Fundações (MDX Docs Pages)

Cada fundação é uma página MDX com exemplos visuais renderizados.

### Colors.mdx
Paleta organizada por categoria:
- **Brand**: Menlo Blue `#85ace6`, Menlo Orange `#F85B00`, Orange Dark `#e05200`, Black `#000000`, Offwhite `#F5F5F0`, White `#FFFFFF`
- **Semânticos**: primary, secondary, surface, background, text, text-muted, text-light, border, border-light
- **Status**: success, warning, danger, info, neutral — cada um com `DEFAULT`, `bg`, `border`, `text`

Cada cor renderizada como swatch com: nome do token CSS, valor hex, classe Tailwind correspondente.

### Typography.mdx
- Font family: Poppins (400, 500, 600, 700)
- Escala: xs (12px), sm (14px), base (16px), lg (18px), xl (20px), 2xl (24px), 3xl (30px)
- Headings: h1 (2xl/700), h2 (xl/600), h3 (lg/500) com line-heights
- Exemplos renderizados com texto real do produto

### Spacing.mdx
- Escala: `--space-1` (4px) → `--space-12` (48px)
- Visualização com blocos proporcionais

### Shadows.mdx
- 3 níveis: soft (`0 2px 8px`), medium (`0 4px 12px`), large (`0 12px 28px`)
- Cards de exemplo aplicando cada sombra

### BorderRadius.mdx
- Escala: sm (8px), md (12px), lg (16px), xl (20px), full (9999px)
- Regras de uso:
  - xl: Cards, modals, dialogs
  - lg: Inputs, dropdowns, large buttons
  - md: Small cards, inner containers
  - sm: Buttons, tags, small elements
  - full: Badges, pills, avatars

### Icons.mdx
- Biblioteca: Lucide React
- Exemplos dos ícones mais usados no app

---

## 3. Componentes (Stories)

Todos os ~35 componentes de `components/ui/` com autodocs + variações interativas.

### Organização por categoria

#### Data Display (8)
| Componente | Variantes |
|---|---|
| MetricCard | default, com trend up/down, loading |
| Badge | default + todas as cores |
| StatusBadge | success, warning, danger, info, neutral |
| DataTable | com dados mock, sorting, pagination |
| Table | básico, striped, compact |
| HeatmapTile | escala de intensidade |
| RiskBar | níveis de risco |
| DunningTimeline | timeline com steps active/completed/pending |

#### Inputs & Forms (7)
| Componente | Variantes |
|---|---|
| Button | primary, secondary, outline, ghost × sm, default, lg + icon-only |
| Input | default, with icon, error state, disabled |
| Select | default, com placeholder, disabled |
| Textarea | default, com contador |
| Switch | on/off, disabled |
| FormField | com label, hint, error message |
| SearchBar | com ícone, loading state |

#### Feedback (6)
| Componente | Variantes |
|---|---|
| CalloutAlert | warning, danger, success, info |
| AlertDialog | com ações primária/secundária |
| ConfirmDialog | com ações destrutivas |
| Toast / Toaster | variantes de status |
| TooltipHint | posições (top, right, bottom, left) |
| Skeleton | variações de formato (text, circle, rect) |

#### Navigation & Layout (7)
| Componente | Variantes |
|---|---|
| Tabs | default, com badge count |
| Stepper | steps active/completed/pending |
| Pagination | com page count |
| Breadcrumbs | com links |
| DropdownMenu | com itens e separadores |
| FilterPills | seleção múltipla |
| Separator | horizontal |

#### Containers (4)
| Componente | Variantes |
|---|---|
| Card | default, com header/footer |
| Dialog | tamanhos (sm, md, lg), com form dentro |
| Label | default, required |
| MenloLogo | variações de tamanho |

#### Domain-Specific (3)
| Componente | Variantes |
|---|---|
| AiInsightsWidget | widget de IA com estados |
| PaymentOptionCard | opções de pagamento |

### Padrão de cada story
- **Default**: estado padrão do componente
- **Variantes**: cada prop relevante como Controls interativo
- **Docs auto-gerados**: tabela de props com tipos e defaults

---

## 4. Tema Custom e Deploy

### Tema do Storybook (`theme.ts`)
- Logo Menlo no sidebar
- Cores brand no chrome do Storybook (sidebar, toolbar)
- `brandTitle: "Menlo Design System"`
- `brandUrl: "https://menlocobranca.vercel.app"`
- Fonte Poppins no UI do Storybook

### Deploy
- Projeto separado no Vercel (team Menlo)
- Build command: `npx storybook build -o storybook-static`
- Output dir: `storybook-static`
- Subdomínio: `design.menlocobranca.vercel.app`
- Build automático no push para `main`

### Organização do Sidebar
```
📖 Introdução
   Welcome
🎨 Fundações
   Colors
   Typography
   Spacing
   Shadows
   Border Radius
   Icons
📦 Componentes
   Data Display
   Inputs & Forms
   Feedback
   Navigation & Layout
   Containers
   Domain-Specific
```

---

## Decisões fora de escopo
- Dark mode (fase posterior)
- Testes visuais / snapshot testing
- Design tokens exportados (Figma sync)
- Changelog automático de componentes
