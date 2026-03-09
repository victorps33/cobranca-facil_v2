# Design: Réguas de Cobrança por Perfil de Risco

**Data:** 2026-03-09
**Status:** Aprovado

## Objetivo

Melhorar a experiência de réguas de cobrança para:
1. Segmentar réguas por perfil de risco dos franqueados (Bom Pagador, Duvidoso, Mau Pagador)
2. Permitir escalonamento de ações (negativação, protesto, jurídico)
3. Visualização por fases com timeline inspirada em régua profissional de cobrança

## Decisões de Design

- **Perfil de risco**: calculado automaticamente (taxa inadimplência + dias médio atraso + valor em aberto)
- **Escalonamento**: semi-automático — sistema gera tarefa, administrador aprova/executa
- **Fases**: pré-definidas (7 fases fixas), com steps customizáveis dentro de cada fase
- **Diferenciação por perfil**: intensidade diferente E alcance diferente (maxPhase)
- **Jurídico**: gera tarefa interna no sistema
- **Boa Vista / Cartório**: mock no front-end, sem integração real por agora

## Abordagem

"Uma régua por perfil" — cada perfil de risco tem sua própria DunningRule. O sistema calcula o score de risco do franqueado e associa automaticamente à régua correspondente.

---

## 1. Modelo de Dados

### Novos enums

```prisma
enum RiskProfile {
  BOM_PAGADOR
  DUVIDOSO
  MAU_PAGADOR
}

enum DunningPhase {
  LEMBRETE
  VENCIMENTO
  ATRASO
  NEGATIVACAO
  COBRANCA_INTENSIVA
  PROTESTO
  POS_PROTESTO
}

enum EscalationType {
  NEGATIVACAO
  PROTESTO
  JURIDICO
}

enum EscalationStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

### Channel expandido

```prisma
enum Channel {
  EMAIL
  SMS
  WHATSAPP
  LIGACAO
  BOA_VISTA
  CARTORIO
  JURIDICO
}
```

### DunningRule — alterações

```prisma
model DunningRule {
  // campos existentes mantidos (id, name, active, timezone, franqueadoraId, createdAt, steps)
  riskProfile  RiskProfile   // qual perfil de risco esta régua atende
  maxPhase     DunningPhase  // até qual fase esta régua vai
}
```

### DunningStep — alterações

```prisma
model DunningStep {
  // campos existentes mantidos (id, ruleId, trigger, offsetDays, channel, template, enabled, createdAt)
  phase  DunningPhase  // a qual fase este step pertence
}
```

### Novo modelo — Score de risco do franqueado

```prisma
model FranchiseeRiskScore {
  id                String       @id @default(cuid())
  customerId        String       @unique
  customer          Customer     @relation(fields: [customerId])
  defaultRate       Float        // % de cobranças inadimplentes
  avgDaysLate       Float        // média de dias de atraso
  totalOutstanding  Int          // valor total em aberto (centavos)
  riskProfile       RiskProfile  // perfil calculado
  calculatedAt      DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
}
```

### Novo modelo — Tarefas de escalonamento

```prisma
model EscalationTask {
  id           String           @id @default(cuid())
  chargeId     String
  charge       Charge           @relation(fields: [chargeId])
  type         EscalationType
  status       EscalationStatus @default(PENDING)
  description  String
  resolvedAt   DateTime?
  resolvedBy   String?
  createdAt    DateTime         @default(now())
}
```

### Regras de cálculo do perfil

| Métrica             | Bom Pagador | Duvidoso     | Mau Pagador |
|---------------------|-------------|--------------|-------------|
| Taxa inadimplência  | < 10%       | 10-30%       | > 30%       |
| Dias médio atraso   | < 5         | 5-15         | > 15        |
| Valor em aberto     | < R$5.000   | R$5.000-20.000 | > R$20.000 |

O perfil final é o **pior** entre as 3 métricas.

### Alcance por perfil (default)

| Perfil       | maxPhase            |
|--------------|---------------------|
| Bom Pagador  | ATRASO              |
| Duvidoso     | COBRANCA_INTENSIVA  |
| Mau Pagador  | POS_PROTESTO        |

---

## 2. UI / Experiência do Usuário

### Tela principal de Réguas (`/reguas`)

**Header:**
- Título "Réguas de Cobrança"
- 3 abas: Bom Pagador | Duvidoso | Mau Pagador
- Badge em cada aba com contagem de franqueados no perfil

**Timeline visual (dentro de cada aba):**
Barra horizontal dividida em fases com cores:

| Fase                 | Cor          |
|----------------------|--------------|
| LEMBRETE             | Cinza claro  |
| VENCIMENTO           | Vermelho     |
| ATRASO               | Laranja      |
| NEGATIVAÇÃO          | Azul escuro  |
| COBRANÇA INTENSIVA   | Azul         |
| PROTESTO             | Preto        |
| PÓS-PROTESTO        | Cinza escuro |

- Fases além do maxPhase ficam opacas/desabilitadas
- Cada node mostra o dia e ícone do canal
- Nodes de escalonamento (Boa Vista, Cartório, Jurídico) com visual diferenciado
- Hover no node mostra preview do template

**Ações:**
- Botão "Editar régua" → tela de edição
- Toggle ativo/inativo da régua

### Tela de edição (`/reguas/[id]`)

**Layout:**
- Sidebar esquerda com fases em accordion
- Cada fase expande para mostrar steps
- Fases desabilitadas com toggle "Ativar fase"

**Dentro de cada fase:**
- Lista de steps: dia, canal, preview do template
- Botão "+ Adicionar step"
- Toggle enable/disable por step

**Formulário de step:**
- Dia relativo (input numérico)
- Canal (dropdown com todos os canais)
  - Canais de escalonamento (Boa Vista, Cartório, Jurídico) mostram aviso: "Esta ação gerará uma tarefa de aprovação"
  - Template desabilitado para canais de escalonamento
- Template da mensagem com variáveis
- Presets de template

**Configuração do perfil (topo):**
- Seletor de maxPhase: "Esta régua vai até a fase: [dropdown]"
- Preview em tempo real das fases ativas vs inativas

### Painel de Escalonamento

`/cobrancas/escalonamento` (ou tab dentro de `/cobrancas`):
- Lista de EscalationTasks pendentes
- Filtros: tipo, status
- Card: franqueado, valor, dias de atraso, tipo da ação
- Ações: "Executar" (mock — marca COMPLETED), "Cancelar"

### Visão de Risco dos Franqueados

Tab dentro de `/clientes`:
- Tabela: Nome, Taxa Inadimplência, Dias Médio Atraso, Valor em Aberto, Perfil de Risco (badge)
- Perfil recalculado automaticamente
- Click mostra histórico de score

---

## 3. Fluxo de Dados e Lógica de Negócio

### Cálculo automático do perfil de risco

**Quando recalcular:**
- Cron job diário
- Ao registrar pagamento
- Ao criar nova cobrança

**Algoritmo:**
1. Para cada franqueado, buscar cobranças dos últimos 12 meses
2. Calcular defaultRate, avgDaysLate, totalOutstanding
3. Aplicar tabela de classificação (pior métrica define o perfil)
4. Upsert no FranchiseeRiskScore

### Fluxo de execução do dunning (atualizado)

```
Cron dispara
  → Para cada cobrança pendente/vencida:
    1. Buscar Customer → FranchiseeRiskScore → riskProfile
    2. Buscar DunningRule ativa para esse riskProfile
    3. Para cada DunningStep (enabled=true):
       a. Calcular se hoje = dueDate + offsetDays
       b. Se sim e step.phase <= rule.maxPhase:
          - Canal de comunicação (EMAIL/SMS/WHATSAPP/LIGACAO):
            → Criar NotificationLog + disparar notificação
          - Canal de escalonamento (BOA_VISTA/CARTORIO/JURIDICO):
            → Criar EscalationTask (PENDING)
            → Notificar administrador
```

### Fluxo de escalonamento

```
EscalationTask criada (PENDING)
  → Admin vê no painel
  → "Executar": mock — marca COMPLETED, registra log
  → "Cancelar": marca CANCELLED
```

### Seed de réguas padrão

**Bom Pagador** (maxPhase: ATRASO):
D-5 Email, D-3 SMS, D-1 WhatsApp, D0 WhatsApp, D+3 SMS, D+7 WhatsApp, D+10 Ligação, D+12 SMS

**Duvidoso** (maxPhase: COBRANCA_INTENSIVA):
Todos do Bom Pagador + D+15 Boa Vista, D+18 SMS, D+20 WhatsApp, D+25 Ligação, D+30 SMS, D+35 WhatsApp

**Mau Pagador** (maxPhase: POS_PROTESTO):
Todos do Duvidoso + D+45 Cartório, D+50 SMS, D+55 WhatsApp, D+65 Ligação, D+75 SMS, D+90 WhatsApp

---

## 4. APIs

| Endpoint                        | Método | Descrição                              |
|---------------------------------|--------|----------------------------------------|
| `/api/risk-scores`              | GET    | Listar scores de todos os franqueados  |
| `/api/risk-scores/recalculate`  | POST   | Forçar recálculo de scores             |
| `/api/escalation-tasks`         | GET    | Listar tarefas de escalonamento        |
| `/api/escalation-tasks/[id]`    | PATCH  | Atualizar status (executar/cancelar)   |

APIs existentes (`/api/dunning-rules`, `/api/dunning-steps`) serão atualizadas para suportar os novos campos.
