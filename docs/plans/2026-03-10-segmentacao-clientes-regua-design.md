# Segmentação de Clientes por Régua - Design

## Overview

Adicionar uma seção expansível dentro de cada card de régua que mostra a segmentação de clientes por fase da régua e competência da cobrança. Ao clicar em "X clientes" no header do card, expande uma tabela interativa. Clicar numa célula mostra os nomes dos clientes inline.

## Interação

- O texto "X clientes" no header do RuleCard vira um botão clicável
- Ao clicar, expande uma seção abaixo da timeline com a tabela de segmentação
- Clicar novamente fecha a seção (toggle)

## Tabela de Segmentação

- **Linhas** = fases ativas da régua (de Lembrete até a `maxPhase`)
- **Colunas** = competências existentes (ex: "Jan/26", "Fev/26", "Mar/26")
- **Células** = contagem de clientes. Clicável — expande inline para mostrar os nomes dos clientes daquela fase + competência
- **Última coluna** = total por fase
- **Última linha** = total por competência

## API

Novo endpoint: `GET /api/dunning-rules/[id]/segmentation`

- Busca cobranças dos clientes com o risk profile da régua
- Agrupa por fase (baseado nos dias de atraso vs. os steps da régua) e por campo `competencia` da Charge
- Retorna a matriz de contagens + lista de clientes por célula

### Response shape

```json
{
  "phases": ["LEMBRETE", "VENCIMENTO", "ATRASO"],
  "competencias": ["2026-01", "2026-02", "2026-03"],
  "matrix": {
    "LEMBRETE": {
      "2026-01": { "count": 5, "customers": [{ "id": "...", "name": "Loja A" }] },
      "2026-02": { "count": 3, "customers": [{ "id": "...", "name": "Loja B" }] }
    }
  },
  "totalsByPhase": { "LEMBRETE": 8, "VENCIMENTO": 12 },
  "totalsByCompetencia": { "2026-01": 10, "2026-02": 15 }
}
```

## Determinação da Fase

A fase de cada cobrança é determinada pelo offset de dias de atraso em relação aos steps da régua. Os thresholds dos steps definem os limites de cada fase. Ex: se a régua tem steps em D+0, D+3, D+15, D+30, D+45, uma cobrança com 20 dias de atraso estaria na fase do step D+15.

## UI

- Tabela com estilo minimalista (sem bordas grossas), consistente com o design monochromático do card
- Células com contagem > 0 têm hover e cursor pointer
- Ao clicar numa célula, expande abaixo da linha uma sub-seção com lista de nomes de clientes
- Clicar novamente fecha a sub-seção
- Células com 0 clientes ficam com texto gray-300, não clicáveis
