# Frontend Multi-ERP — Design (Escopo Mínimo)

> **Data:** 2026-03-12
> **Status:** Aprovado
> **Objetivo:** Adicionar UI para conexão de ERP nas configurações e exibição de status da NF na cobrança.

---

## 1. Seção ERP na Aba "Integrações" (Configurações)

Na página `/configuracoes`, aba "Integrações", adicionar uma seção **"ERP / Sistema de Gestão"** acima das integrações existentes (Twilio, Julia IA).

### Layout: Lista Simples

Cada ERP é uma row com: ícone, nome, descrição curta, e botão de ação.

### Omie

- **Desconectado:** Botão "Configurar" abre um `Dialog` com campos:
  - App Key (input text)
  - App Secret (input text)
  - Botão "Salvar" → `POST /api/erp-config` com `{ provider: "OMIE", omieAppKey, omieAppSecret }`
- **Conectado:** Fundo verde claro, texto "✓ Configurado", botão "Desconectar"

### Conta Azul

- **Desconectado:** Botão "Conectar" → redireciona para `GET /api/integrations/conta-azul/authorize` (OAuth2 já implementado no backend)
- **Conectado:** Fundo verde claro, texto "✓ Conectado — Última sync há X min", botão "Desconectar"

### Regras

- Apenas 1 ERP ativo por franqueadora — ao conectar um, o outro fica desabilitado visualmente
- Configuração feita pelo admin da franqueadora (role ADMINISTRADOR)
- Ao desconectar, faz `PATCH /api/erp-config` com `{ provider: "NONE" }`

### Novo Endpoint

`POST /api/erp-config` — Cria ou atualiza ERPConfig para a franqueadora autenticada.

```typescript
// Request body
{
  provider: "OMIE" | "CONTA_AZUL" | "NONE";
  omieAppKey?: string;
  omieAppSecret?: string;
}

// Response
{ success: true, provider: string }
```

`GET /api/erp-config` — Retorna ERPConfig da franqueadora (sem secrets).

`PATCH /api/erp-config` — Atualiza parcialmente (ex: desconectar).

Requer role: ADMINISTRADOR.

---

## 2. Status da NF na Cobrança

Na página de detalhe da cobrança (`/cobrancas/[id]`).

### Tipo Cobranca

Adicionar ao tipo `Cobranca` em `lib/types/index.ts`:

```typescript
invoiceNumber?: string;
invoiceStatus?: string;    // "EMITIDA" | "CANCELADA" | "PENDENTE" | null
invoicePdfUrl?: string;
invoiceIssuedAt?: string;
```

### Badge de Status

Ao lado de "Nota Fiscal" no sidebar da cobrança:

| invoiceStatus | Badge | Cor |
|---------------|-------|-----|
| `null` | (nenhum) | — |
| `"PENDENTE"` | Emitindo... | Amarelo |
| `"EMITIDA"` | NF #123 | Verde |
| `"CANCELADA"` | Cancelada | Vermelho |

### Botão "Emitir NF"

- Usa o componente `EmitirNfDialog` existente
- Ao confirmar, chama `POST /api/charges/[id]/invoice` (endpoint já implementado no backend)
- Quando `invoiceStatus === "PENDENTE"`, botão desabilitado com texto "Emitindo..."
- Quando `invoiceStatus === "EMITIDA"`, botão vira "Baixar NF" abrindo `invoicePdfUrl`

### Link "Baixar NF"

- Quando `invoicePdfUrl` existe, o `NotaFiscalViewerDialog` existente abre o PDF
- Quando não existe, link não aparece

---

## Arquivos Impactados

### Novos

- `app/api/erp-config/route.ts` — CRUD de configuração ERP
- `components/configuracoes/erp-config-section.tsx` — Seção ERP na aba Integrações
- `components/configuracoes/omie-config-dialog.tsx` — Dialog de configuração Omie

### Modificados

- `app/(dashboard)/configuracoes/page.tsx` — Adicionar seção ERP na aba Integrações
- `app/(dashboard)/cobrancas/[id]/page.tsx` — Adicionar badge NF e conectar EmitirNfDialog ao novo endpoint
- `lib/types/index.ts` — Adicionar campos de invoice ao tipo Cobranca
