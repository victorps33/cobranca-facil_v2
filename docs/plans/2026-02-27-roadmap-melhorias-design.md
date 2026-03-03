# Roadmap de Melhorias — Menlo Cobrança

**Contexto:** Projeto em escala com clientes ativos. Abordagem "Foundations First" — segurança e estabilidade antes de performance e polish.

**Repositório:** https://github.com/victorps33/cobranca-facil_v2
**Deploy:** https://menlocobranca.vercel.app

---

## Fase 1: Segurança & Estabilidade

### 1.1 Rate Limiting
- Middleware customizado com `Map` (IP + janela de tempo)
- Limites: 100 req/min APIs gerais, 10 req/min auth, 5 req/min webhooks
- Resposta `429 Too Many Requests` com header `Retry-After`
- Sem dependência externa

### 1.2 Error Handling Global
- Error boundary React no dashboard layout
- Substituir todos os `.catch(() => {})` por logging + toast
- Wrapper `apiHandler()` para API routes (captura, loga, retorna formato padrão)
- Sentry para error tracking (ou console.error estruturado como passo inicial)

### 1.3 Validação Server-Side
- Zod schemas para body de todas API routes de escrita (POST/PATCH/DELETE)
- Reutilizar schemas entre client e server
- Retornar erros com campo + mensagem específica

### 1.4 Audit Logging
- Nova tabela `AuditLog` no Prisma: `userId`, `action`, `entity`, `entityId`, `details (JSON)`, `createdAt`
- Logar: criar/editar/deletar clientes, cobranças, réguas, configurações
- Helper `logAudit()` nas API routes

### 1.5 Corrigir Erros Silenciosos
- Grep por `.catch(() =>` em todo o projeto
- Substituir por tratamento adequado (toast, log, ou re-throw)

---

## Fase 2: Performance & Data

### 2.1 React Query (TanStack Query)
- `@tanstack/react-query` com `QueryClientProvider` no root layout
- Migrar `useEffect` + `fetch` para `useQuery`/`useMutation`
- Começar por: dashboard, clientes, cobranças

### 2.2 Server-Side Pagination
- API routes aceitam `page` e `pageSize` como query params
- Prisma `skip`/`take` + `count`
- Formato: `{ data: [], total, page, pageSize }`
- Aplicar em: customers, charges, tasks, interactions, conversations

### 2.3 Otimizar Inbox Polling
- Substituir polling 3-5s por Server-Sent Events (SSE)
- Endpoint `/api/inbox/stream`
- Fallback para polling se SSE falhar

### 2.4 Índices no Banco
- `Customer`: `(franqueadoraId, statusLoja)`, `(franqueadoraId, doc)`
- `Charge`: `(franqueadoraId, status)`, `(franqueadoraId, competencia)`, `(customerId, status)`
- `Conversation`: `(franqueadoraId, status)`, `(customerId)`
- `NotificationLog`: `(chargeId, status)`

---

## Fase 3: Qualidade de Código

### 3.1 Setup de Testes
- Vitest + @testing-library/react + @testing-library/jest-dom
- Helpers: mock Prisma, mock session, factories

### 3.2 Testes Unitários Prioritários
- `lib/agent/ai.ts`, `lib/agent/orchestrator.ts`, `lib/agent/escalation.ts`
- `lib/apuracao-*.ts` (cálculos financeiros)
- `lib/utils.ts`, `lib/password.ts`
- API routes: charges, customers, dunning-run

### 3.3 Quebrar Componentes Grandes
- Componentes 500+ linhas → hooks + sub-componentes + constantes
- Alvos: cobranças, inbox, configurações, CRM

### 3.4 Extrair Utilitários
- `lib/formatters.ts` — fmtBRL, fmtDate, fmtCPFCNPJ
- `lib/constants.ts` — localStorage keys, status configs
- `lib/api-helpers.ts` — wrapper de fetch padrão

### 3.5 Limpeza
- Investigar/remover backend Python (`/backend/`)
- Renomear package de "asaas-mockup" para "menlo-cobranca"
- Remover dependência `pg` se não usada

---

## Fase 4: Polish

### 4.1 React Hook Form + Zod
- Reutilizar Zod schemas da Fase 1
- Migrar forms: novo cliente, nova cobrança, franqueadora, registro, configurações

### 4.2 Zustand para State Management
- Substituir AppDataProvider por stores Zustand
- Stores: useAppStore, usePreferencesStore
- Remover polling manual — usar React Query refetchInterval

### 4.3 Virtual Scrolling
- `@tanstack/react-virtual` para tabelas com 100+ items
- Paginação como fallback para datasets menores

### 4.4 Acessibilidade (WCAG 2.1 AA)
- Focus trap nos modais
- aria-live para notificações
- Contraste de cores
- Labels em todos os inputs
- Keyboard navigation nas tabelas
