# Criação Conversacional de Campanhas - Design

## Overview

Página `/reguas/campanhas/nova` com layout split: chat AI à esquerda (~55%) + preview do CampaignCard à direita (~45%). A AI guia o usuário na criação da campanha de forma conversacional, com sugestões baseadas nos dados reais do tenant.

## Página `/reguas/campanhas/nova`

Layout split horizontal. Chat à esquerda, preview à direita. Responsivo: em mobile, chat em fullscreen com botão para ver preview.

## Chat AI (esquerda)

- Interface de chat similar à Julia (streaming SSE, markdown, sugestões clicáveis)
- Endpoint: `POST /api/chat` com `pageContext: "campaign-creation"`
- System prompt especializado em criação de campanhas com dados reais do tenant
- Ao abrir, a AI saúda e apresenta 3 sugestões baseadas na situação das dívidas:
  - Geradas dinamicamente a partir dos dados reais (cobranças pendentes, perfis, métricas)
  - Exemplos: "Renegociar dívidas acima de 90 dias", "Campanha para parcelas em atraso recente", "Recuperar alto valor pendente"
- O usuário conversa livremente para definir:
  - Nome da campanha
  - Período (startDate, endDate)
  - Condições comerciais (maxCashDiscount, maxInstallments, monthlyInterestRate, minInstallmentCents)
  - Público-alvo (targetFilters: dias de atraso, faixa de valor, perfil de risco)
  - Canais de comunicação e templates de mensagem (steps)
- A AI sugere valores baseados nas métricas reais
- Ao final, a AI apresenta resumo completo e pergunta "Deseja criar esta campanha?"
- Ao confirmar, o frontend chama `POST /api/negotiation-campaigns` com os dados acumulados e retorna sucesso

## Preview (direita)

- Reutiliza o componente `CampaignCard` existente da página de réguas
- Começa com empty state: "Defina sua campanha na conversa ao lado"
- Atualiza em tempo real conforme a AI define cada campo
- A AI emite marcadores estruturados no response: `<<CAMPAIGN_UPDATE>>JSON<<END>>`
- O frontend parseia o JSON e atualiza o estado do card preview
- Campos parciais mostram placeholder (ex: nome "—" até ser definido)

## Marcador CAMPAIGN_UPDATE

Formato emitido pela AI dentro do stream:

```
<<CAMPAIGN_UPDATE>>
{
  "name": "Renegociação 90+ dias",
  "startDate": "2026-03-15",
  "endDate": "2026-04-15",
  "maxCashDiscount": 0.15,
  "maxInstallments": 6,
  "monthlyInterestRate": 0.02,
  "minInstallmentCents": 5000,
  "status": "DRAFT",
  "targetFilters": { "minDaysOverdue": 90 },
  "steps": []
}
<<END>>
```

Cada update é incremental — o frontend faz merge com o estado anterior.

## System Prompt (campaign-creation)

- Persona: assistente especializado em campanhas de renegociação
- Contexto: dados do tenant (total cobranças pendentes por faixa de atraso, distribuição de valores, perfis de risco)
- Instruções: guiar o usuário passo a passo, sugerir valores realistas, emitir CAMPAIGN_UPDATE a cada decisão
- Restrição: não criar a campanha sozinha — sempre pedir confirmação final

## Fluxo de Confirmação

1. AI apresenta resumo completo da campanha
2. AI pergunta: "Deseja criar esta campanha?"
3. Usuário confirma no chat
4. Frontend chama `POST /api/negotiation-campaigns` com o estado acumulado do preview
5. Se sucesso, AI confirma com link para a campanha
6. Se erro, AI mostra o erro e sugere correção
