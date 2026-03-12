# Landing Page — Menlo Cobrança

**Data**: 2026-03-12
**Status**: Aprovado

## Objetivo

Criar uma landing page pública para a plataforma Menlo Cobrança, com foco em empresas com cobrança recorrente. O objetivo é que visitantes agendem uma demo após ver o produto em ação.

## Decisões de Design

- **Estilo**: Clean & Profissional — fundo offwhite, tipografia forte, identidade visual Menlo
- **"Vídeo"**: Animação CSS do fluxo de cobrança (sem vídeo real), com IntersectionObserver para trigger ao scroll
- **Hero**: Fullscreen com screenshot do produto no background + overlay gradiente
- **CTA principal**: Agendar Demo (link externo configurável, ex: Calendly)

## Seções

### 1. Navbar

- Fixa no topo, fundo transparente → offwhite ao scroll
- Logo Menlo (componente `MenloLogo` existente) à esquerda
- Link "Login" (`/auth/login`) à direita

### 2. Hero Fullscreen

- **Background**: Mockup estático do dashboard em HTML/CSS, opacity 15-20%
- **Overlay**: Gradiente vertical `rgba(245,245,240, 0.85)` → `rgba(245,245,240, 1)`
- **Conteúdo centralizado**:
  - Tag: "MENLO COBRANÇA" — uppercase, `#F85B00`, letter-spacing 2px
  - Título: "Recupere receita com cobrança automatizada" — `text-4xl md:text-5xl font-bold`
  - Subtítulo: "Crie réguas de cobrança inteligentes, automatize comunicações e acompanhe resultados em tempo real." — `text-gray-500`
  - CTA primário: "Agendar Demo" — `bg-menlo-orange text-white`, link externo
  - CTA secundário: "Ver em ação ↓" — `bg-white border`, scroll suave para seção demo

### 3. Demo Animada

- **Container**: Browser frame falso
  - Dots (vermelho/amarelo/verde) + barra de URL "app.menlocobranca.com.br"
  - `rounded-2xl`, `shadow-large`
- **Conteúdo**: 3 telas do fluxo em loop:
  1. **Nova Cobrança** — Mockup do formulário (campos, botão)
  2. **Régua Ativa** — Timeline de régua dinâmica (lembrete → notificação → escalação)
  3. **Resultado** — Dashboard com métricas (receita recuperada, taxa de sucesso)
- **Animação**:
  - IntersectionObserver ativa a animação quando visível
  - Cada tela: fade-in + slide-up, delay 2s entre elas
  - Após primeira passagem, cicla em loop com crossfade
- **Indicadores**: 3 dots abaixo do frame mostrando tela ativa

### 4. Features (3 cards)

- **Background**: Branco
- **Layout**: 3 colunas (desktop), stack vertical (mobile)
- **Cards**:
  | Ícone (Lucide) | Título | Descrição |
  |-----------------|--------|-----------|
  | `Zap` | Réguas Inteligentes | Automatize o fluxo de cobrança do início ao fim |
  | `Brain` | IA Integrada | Julia analisa padrões e sugere as melhores ações |
  | `TrendingUp` | Resultados Reais | Acompanhe recuperação de receita em tempo real |

### 5. CTA Final

- **Background**: `#F5F5F0` (offwhite)
- Título: "Pronto pra recuperar receita?"
- Subtítulo: "Agende uma demo e veja como a Menlo funciona pro seu negócio"
- Botão: "Agendar Demo Gratuita" → mesmo link externo do hero

## Arquitetura Técnica

### Rota

- Arquivo: `app/landing/page.tsx`
- Rota pública — sem autenticação
- Layout próprio (sem sidebar/topbar do dashboard)

### Middleware

- Adicionar `landing` ao regex de exclusão no matcher de `middleware.ts` (padrão existente: negative-lookahead regex)

### Componentes

- `app/landing/page.tsx` — página principal com todas as seções
- Componentes inline (não extrair a menos que ultrapasse ~150 linhas por seção)
- Reutilizar `MenloLogo` de `components/brand/MenloLogo.tsx` (variant `"default"`, size `"md"`)
- Ícones via `lucide-react` (já instalado)

### CSS / Animação

- Tailwind para layout e estilo
- `@keyframes` em `globals.css` para as animações da demo:
  - Reutilizar `fadeInUp` existente (translateY 12px) para entrada dos elementos
  - Novo `crossfade`: opacity cycling entre as 3 telas (criar em globals.css)
- IntersectionObserver nativo em um `useEffect` — sem dependências externas
- Animação dos dots indicadores sincronizada com o crossfade

### Responsividade

- Mobile-first
- Breakpoints: `sm` (640px), `md` (768px), `lg` (1024px)
- Hero: título reduz para `text-3xl` em mobile
- Features: stack vertical em mobile, 3 colunas em `md+`
- Browser frame: margens laterais reduzidas em mobile

### Dados

- Nenhuma chamada a API ou banco de dados
- Página 100% estática (pode ser ISR/static export)
- URL do CTA configurável via constante no topo do arquivo

### Dark Mode

- Landing page é light-mode only (cores hardcoded da marca)
- Não responde a `prefers-color-scheme`

### Footer

- Sem footer no MVP — página termina no CTA final

## Fora de Escopo

- Formulário de contato inline
- Analytics/tracking
- Integrações com Calendly embed
- SEO avançado (meta tags básicas sim, structured data não)
- Blog ou páginas adicionais
- Internacionalização
