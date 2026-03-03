# Design: Fórmula Animal — Multi-Franqueadora com Grupo

**Data:** 2026-03-03
**Status:** Aprovado

## Contexto

A franqueadora Fórmula Animal trabalha com duas subsidiárias: Remar e Fórmula. Precisa de um usuário admin que veja dados de ambas, faça upload CSV de clientes/cobranças, e pergunte qualquer coisa para a agente Júlia — incluindo comparações entre subsidiárias.

## Abordagem Escolhida: Grupo de Franqueadoras

Criar um modelo `GrupoFranqueadora` que agrupa múltiplas franqueadoras. O usuário "super" pertence ao grupo e alterna entre elas via seletor na sidebar.

## 1. Modelo de Dados

**Novo modelo `GrupoFranqueadora`:**

| Campo         | Tipo     | Descrição              |
|---------------|----------|------------------------|
| id            | String   | cuid                   |
| nome          | String   | "Fórmula Animal"       |
| createdAt     | DateTime | auto                   |
| updatedAt     | DateTime | auto                   |
| franqueadoras | Relation | Franqueadora[]         |
| users         | Relation | User[]                 |

**Alterações em modelos existentes:**

- `Franqueadora` ganha `grupoId` (opcional) → FK para `GrupoFranqueadora`
- `User` ganha `grupoFranqueadoraId` (opcional) → FK para `GrupoFranqueadora`
- Se `grupoFranqueadoraId` existe, o user é "super" e pode ver todas as franqueadoras do grupo
- Se só tem `franqueadoraId`, funciona como hoje (single-tenant)

**Fluxo de resolução de tenant:**

1. User com `grupoFranqueadoraId` → pode selecionar qualquer franqueadora do grupo, ou "Todas"
2. User com só `franqueadoraId` → comportamento atual, sem mudança

## 2. Seletor de Franqueadora na Sidebar

- Componente `FranqueadoraSelector` visível apenas para users com `grupoFranqueadoraId`
- Dropdown com opções: "Todas", "Remar", "Fórmula"
- Estado em cookie/localStorage (persiste entre reloads)
- Contexto React (`FranqueadoraContext`) expõe `activeFranqueadoraId: string | "all"`
- Chamadas de API passam header `x-franqueadora-id`

**Backend:**

- Criar `requireTenantOrGroup()` que retorna `tenantIds: string[]`
- Queries Prisma usam `where: { franqueadoraId: { in: tenantIds } }`
- Validação: backend confirma que o franqueadoraId pertence ao grupo do user

## 3. Adaptação da Júlia

- `buildDataContext` passa a receber `tenantIds: string[]`
- Com uma franqueadora: comportamento atual
- Com "Todas": dados organizados por subsidiária no contexto
- System prompt recebe instrução adicional para comparações entre subsidiárias
- Novos preset questions comparativos quando "Todas" selecionado

## 4. Upload CSV

- Endpoint `POST /api/import/csv` recebe arquivo + `franqueadoraId` destino
- Suporta CSV/Excel para clientes e cobranças
- UI em `/configuracoes` ou `/clientes` com drag & drop, preview, e feedback de erros
- Validações: campos obrigatórios, duplicatas, formato de valores

## 5. Setup Fórmula Animal

**Entidades criadas:**

1. GrupoFranqueadora "Fórmula Animal"
2. Franqueadora "Remar" (com DunningRule + AgentConfig padrão)
3. Franqueadora "Fórmula" (idem)
4. Usuário admin com role ADMINISTRADOR, vinculado ao grupo

**Script:** `prisma/seed-formula-animal.ts` executável via `npx tsx`

## Fluxo do Usuário

1. Login com email/senha
2. Vê seletor com "Todas", "Remar", "Fórmula"
3. Upload CSV dos dados de cada subsidiária
4. Pergunta o que quiser para a Júlia (incluindo comparações)
