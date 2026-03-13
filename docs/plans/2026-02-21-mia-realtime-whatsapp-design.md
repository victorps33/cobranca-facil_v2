# Design: Mia — Resposta em Tempo Real no WhatsApp + Melhorias

**Data:** 2026-02-21
**Status:** Aprovado

---

## Problema

A agente Mia (IA de cobranca) ja existe e funciona, mas as respostas demoram 5-30 minutos porque dependem de um cron job para despachar mensagens da fila. Alem disso, faltam acoes importantes (enviar boleto, negociar parcelamento, etc.) e o contexto/prompt podem ser melhorados.

## Objetivos

1. Mia responde no WhatsApp em tempo real (2-5 segundos)
2. Prompt mais inteligente com tom adaptativo
3. Contexto enriquecido (historico de pagamentos, score de risco, dados do boleto)
4. Novas acoes: enviar boleto, negociar parcelamento, marcar promessa, agendar callback
5. Regras de negociacao configuraveis por franqueadora
6. 100% automatica (escala para humano apenas via safety nets)

---

## Arquitetura: Queue com Dispatch Instantaneo

```
Cliente envia WhatsApp
    |
[Webhook Twilio] /api/webhooks/twilio
    |- Salva Message (sender=CUSTOMER)
    |- Conversation -> status "PENDENTE_IA"
    '- Fire-and-forget -> /api/agent/process-inbound
                              |
                    [Orchestrator] processInboundMessage()
                        |- Constroi contexto enriquecido
                        |- Chama Claude (Mia) -> decisao JSON
                        |- Safety nets (escalacao forcada se necessario)
                        |- Executa acao (boleto, negociacao, promessa, callback)
                        |- Loga decisao em AgentDecisionLog
                        '- Enfileira em MessageQueue com priority=IMMEDIATE
                              |
                    [Dispatch Imediato] dispatchImmediate()
                        |- Busca items IMMEDIATE pendentes
                        |- Chama sendWhatsApp() via Twilio
                        |- Salva Message (sender=AI)
                        |- Cria InteractionLog (OUTBOUND)
                        '- Atualiza status -> SENT/FAILED
                              |
                    [Se falhar] Retry via cron job (como hoje)
```

### Por que Queue Instantaneo (vs Dispatch Direto ou Sincrono)

- **Resiliencia:** Se o envio falhar, o item fica na fila para retry via cron
- **Auditoria:** Toda mensagem passa pela MessageQueue, mantendo rastreabilidade
- **Consistencia:** Mesmo pipeline para mensagens imediatas e agendadas

---

## Contexto Enriquecido

### Dados adicionais no context-builder

| Dado | Fonte | Proposito |
|------|-------|-----------|
| Historico de pagamentos (6 meses) | Charges com status PAID | Identificar padrao de bom/mau pagador |
| Promessas anteriores | AgentDecisionLog (MARK_PROMISE) | Saber se cumpriu/quebrou promessas |
| Score de risco | Calculo: atraso medio + % inadimplencia + promessas quebradas | Tom adaptativo |
| Dados do boleto | Boleto (linhaDigitavel, publicUrl) | Enviar quando solicitado |
| Regras de negociacao | AgentConfig | Limites para Mia negociar |

---

## Prompt Melhorado

### Tom Adaptativo

- **Cliente bom pagador** (score baixo): abordagem suave, compreensiva
- **Inadimplente recorrente** (score alto): abordagem firme mas respeitosa
- **Primeiro contato**: tom neutro e acolhedor

### Novas Acoes no JSON de Resposta

```json
{
  "action": "RESPOND_CUSTOMER | SEND_BOLETO | NEGOTIATE | MARK_PROMISE | SCHEDULE_CALLBACK | ESCALATE_HUMAN | SKIP",
  "message": "texto para enviar ao cliente (max 300 chars)",
  "confidence": 0.85,
  "reasoning": "explicacao interna",
  "metadata": {
    "promiseDate": "2026-03-01",
    "installments": 3,
    "callbackDate": "2026-02-22T14:00:00",
    "chargeId": "xxx"
  }
}
```

---

## Regras de Negociacao (configuraveis por franqueadora)

### Novos campos no AgentConfig

| Campo | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| maxInstallments | Int | 6 | Maximo de parcelas |
| monthlyInterestRate | Float | 0.02 | Taxa de juros mensal (2%) |
| maxCashDiscount | Float | 0.10 | Desconto max pagamento a vista (10%) |
| minInstallmentCents | Int | 5000 | Parcela minima (R$ 50) |
| maxFirstInstallmentDays | Int | 30 | Prazo max para 1a parcela |
| negotiationRules | Json? | null | Regras por faixa de valor |

### Regras por faixa de valor (exemplo)

```json
[
  { "minCents": 0, "maxCents": 50000, "maxInstallments": 2, "interestRate": 0 },
  { "minCents": 50001, "maxCents": 200000, "maxInstallments": 4, "interestRate": 0.015 },
  { "minCents": 200001, "maxCents": null, "maxInstallments": 6, "interestRate": 0.02 }
]
```

Se o cliente pedir algo fora das regras -> escala para humano.

---

## Execucao das Acoes

### SEND_BOLETO
1. Busca Boleto vinculado a Charge do contexto
2. Monta mensagem com publicUrl e/ou linhaDigitavel
3. Enfileira como IMMEDIATE
4. Se nao existir boleto -> responde "verificando" + cria task para humano

### NEGOTIATE
1. Valida proposta contra regras da franqueadora
2. Dentro das regras -> responde com proposta formatada
3. Fora das regras -> escala para humano com contexto
4. Loga proposta no AgentDecisionLog.metadata

### MARK_PROMISE
1. Registra promessa (data, valor) no AgentDecisionLog.metadata
2. Cria CollectionTask com dueDate = data promessa + 1 dia
3. Confirma ao cliente

### SCHEDULE_CALLBACK
1. Cria CollectionTask [CALLBACK] com dueDate e priority ALTA
2. Ajusta para proximo horario comercial se fora do expediente
3. Confirma ao cliente

### ESCALATE_HUMAN
- Sem mudanca (ja funciona)

### RESPOND_CUSTOMER
- Sem mudanca (resposta generica)

---

## Mudancas Tecnicas

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| prisma/schema.prisma | Campos de negociacao no AgentConfig |
| lib/agent/context-builder.ts | Contexto enriquecido |
| lib/agent/prompts.ts | Prompt melhorado + novas acoes |
| lib/agent/ai.ts | Parsing de novas acoes e metadata |
| lib/agent/orchestrator.ts | Executar novas acoes + dispatch imediato |
| lib/agent/dispatch.ts | dispatchImmediate() |
| lib/agent/escalation.ts | Negociacao fora dos limites |

### Arquivos novos

| Arquivo | Proposito |
|---------|-----------|
| lib/agent/actions/send-boleto.ts | Buscar e enviar boleto |
| lib/agent/actions/negotiate.ts | Validar contra regras da franqueadora |
| lib/agent/actions/mark-promise.ts | Registrar promessa + task follow-up |
| lib/agent/actions/schedule-callback.ts | Criar task de callback |

### Sem mudancas em
- Webhook do Twilio (ja funciona)
- Inbox UI (ja mostra mensagens de AI)
- MessageQueue (ja tem campo priority)
- Cron job (continua como fallback)
