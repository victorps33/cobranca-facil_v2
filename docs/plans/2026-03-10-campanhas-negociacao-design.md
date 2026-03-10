# Campanhas de Negociacao - Design

## Overview

Adicionar uma seção de "Campanhas de Negociação" à página de Réguas, acessível via tabs. Campanhas são réguas temporárias de renegociação que rodam em paralelo às réguas padrão, combinando uma timeline de steps automáticos com condições comerciais específicas.

## Navegação

Duas tabs no topo da página `/reguas`:
- **Réguas Padrão** — tela atual, sem mudanças
- **Campanhas** — nova seção

## Modelo de Dados

### NegotiationCampaign

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | String (cuid) | PK |
| name | String | Nome da campanha |
| description | String? | Descrição opcional |
| status | CampaignStatus | DRAFT, ACTIVE, ENDED |
| startDate | DateTime | Início da campanha |
| endDate | DateTime | Fim da campanha |
| franqueadoraId | String? | Multi-tenant |
| createdAt | DateTime | Criação |

### Público-alvo (NegotiationCampaignTarget)

Filtros automáticos armazenados como JSON no campo `targetFilters`:
- Perfil de risco (BOM_PAGADOR, DUVIDOSO, MAU_PAGADOR)
- Dias de atraso mínimo
- Faixa de valor da dívida (min/max)

Seleção manual via tabela de junção `NegotiationCampaignCustomer`:
- campaignId → NegotiationCampaign
- customerId → Customer

### Condições Comerciais (campos na NegotiationCampaign)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| maxCashDiscount | Float | Desconto à vista máximo (ex: 0.20 = 20%) |
| maxInstallments | Int | Nº máximo de parcelas |
| monthlyInterestRate | Float | Taxa de juros mensal |
| minInstallmentCents | Int | Valor mínimo da parcela em centavos |

### Timeline de Steps (NegotiationCampaignStep)

Mesma estrutura das réguas padrão:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | String (cuid) | PK |
| campaignId | String | FK → NegotiationCampaign |
| trigger | DunningTrigger | BEFORE_DUE, ON_DUE, AFTER_DUE |
| offsetDays | Int | Dias relativos ao trigger |
| channel | Channel | EMAIL, SMS, WHATSAPP, etc. |
| template | String | Template da mensagem |
| enabled | Boolean | Ativo/inativo |

## UI - Tab Campanhas

### Card da Campanha

- Header: nome + status badge (Rascunho cinza / Ativa verde / Encerrada gray) + período (dd/mm - dd/mm)
- Resumo: nº clientes impactados, condições comerciais (desconto, parcelas, juros)
- Timeline compacta com steps (reutiliza componentes TimelineView e ScrollFadeContainer)
- Ações: Editar, Ativar/Encerrar, botão criar nova campanha

### Empty State

Quando não há campanhas, mostrar empty state com CTA "Criar campanha".

## Comportamento

- Campanhas rodam em paralelo às réguas padrão
- Régua padrão = cobranças em dia / atraso recente
- Campanha = renegociação de dívidas antigas
- Condições comerciais disponíveis para o agente AI durante período ativo
- Campanha encerra automaticamente na data fim (status → ENDED)
- Campanha pode ser encerrada manualmente antes da data fim

## API Routes

- `GET /api/negotiation-campaigns` — lista campanhas
- `POST /api/negotiation-campaigns` — cria campanha
- `GET /api/negotiation-campaigns/[id]` — detalhe
- `PATCH /api/negotiation-campaigns/[id]` — atualiza
- `DELETE /api/negotiation-campaigns/[id]` — remove (só DRAFT)
- `POST /api/negotiation-campaigns/[id]/customers` — adiciona clientes manuais
