from app.core.config import settings
from app.data.clientes_dummy import franqueados_dummy, get_franqueados_stats
from app.data.cobrancas_dummy import cobrancas_dummy, get_cobrancas_stats
from app.data.apuracao_historico_dummy import ciclos_historico


def get_anthropic_client():
    """Return Anthropic client or None if no valid key."""
    key = settings.ANTHROPIC_API_KEY
    if not key or key.startswith("sk-ant-your"):
        return None
    from anthropic import Anthropic
    return Anthropic(api_key=key)


JULIA_SYSTEM_PROMPT = """Você é Júlia, a Agente Menlo IA — analista de dados especializada em redes de franquias e gestão de cobranças.

**Persona:**
- Nome: Júlia
- Papel: Analista de dados da rede
- Tom: Profissional, amigável, resolutivo
- Estilo: Direto, com insights acionáveis

**Diretrizes de resposta:**
1. Seja concisa e objetiva (máximo 250 palavras)
2. Use os dados reais fornecidos abaixo — cite números concretos
3. Sempre sugira ações concretas
4. Formate com bullet points e **negrito** para destaque
5. Termine com uma pergunta ou sugestão de próximo passo

**Formato padrão:**
**Resumo**
<1-2 frases resumindo a análise>

**Insights**
- <insight 1 com número/dado>
- <insight 2>
- <insight 3>

**Ações recomendadas**
1. <ação concreta>
2. <ação concreta>

**Próximo passo**
<sugestão ou pergunta para continuar>"""

SUGGESTIONS_INSTRUCTION = """

IMPORTANTE: Ao final da sua resposta, após uma linha em branco, adicione exatamente 3 sugestões curtas de follow-up (máx 50 caracteres cada) neste formato exato:
<<SUGESTÕES>>
Sugestão curta 1
Sugestão curta 2
Sugestão curta 3"""

ACTIONS_INSTRUCTION = """

Após as sugestões, inclua um plano de ação executável com 2-4 ações concretas:
<<AÇÕES>>
tipo|parametro|rotulo|descricao

Tipos disponíveis:
- navigate|/rota-do-app|Rótulo da ação|Descrição curta
- export|tipo-de-export|Rótulo da ação|Descrição curta
- notify|id-notificacao|Rótulo da ação|Descrição curta

Rotas disponíveis para navigate:
- /clientes/ID → página do franqueado
- /reguas → configuração de réguas de cobrança
- /cobrancas → lista de cobranças
- /cobrancas/nova → criar nova cobrança

Tipos de export disponíveis:
- cobrancas-vencidas → exporta cobranças vencidas

Use ações que façam sentido para os insights apresentados. Sempre inclua pelo menos 2 ações."""


def fmt_brl(cents: int) -> str:
    """Format cents as BRL currency string."""
    return f"R$ {cents / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def build_data_context() -> str:
    """Build data context string for the AI from dummy data."""
    franqueados = franqueados_dummy
    stats_cob = get_cobrancas_stats(cobrancas_dummy)

    by_status = {
        "saudavel": sum(1 for f in franqueados if f["status"] == "Saudável"),
        "controlado": sum(1 for f in franqueados if f["status"] == "Controlado"),
        "exigeAtencao": sum(1 for f in franqueados if f["status"] == "Exige Atenção"),
        "critico": sum(1 for f in franqueados if f["status"] == "Crítico"),
    }
    pmr_medio = round(sum(f["pmr"] for f in franqueados) / len(franqueados))
    total_aberto = sum(f["valorAberto"] for f in franqueados)
    total_emitido = sum(f["valorEmitido"] for f in franqueados)
    total_recebido = sum(f["valorRecebido"] for f in franqueados)

    criticos = "\n".join(
        f"  - {f['nome']} ({f['cidade']}/{f['estado']}): status={f['status']}, PMR={f['pmr']}d, "
        f"inadimplência={f['inadimplencia']*100:.1f}%, aberto={fmt_brl(f['valorAberto'])}"
        for f in franqueados
        if f["status"] in ("Crítico", "Exige Atenção")
    )

    todos = "\n".join(
        f"  - {f['nome']} ({f['cidade']}/{f['estado']}): status={f['status']}, PMR={f['pmr']}d, "
        f"inadimplência={f['inadimplencia']*100:.1f}%, emitido={fmt_brl(f['valorEmitido'])}, "
        f"recebido={fmt_brl(f['valorRecebido'])}, aberto={fmt_brl(f['valorAberto'])}"
        for f in franqueados
    )

    vencidas = [c for c in cobrancas_dummy if c["status"] == "Vencida"]
    valor_vencido = sum(c["valorAberto"] for c in vencidas)
    vencidas_sorted = sorted(vencidas, key=lambda c: c["valorAberto"], reverse=True)[:10]
    vencidas_detail = "\n".join(
        f"  - {c['cliente']}: {c['descricao']} — {fmt_brl(c['valorAberto'])} (venc. {c['dataVencimento']})"
        for c in vencidas_sorted
    )

    apuracao_summary = "\n".join(
        f"  - {c['competencia']}: {c['franqueados']} franqueados, fat={fmt_brl(c['faturamentoTotal'])}, "
        f"cobrado={fmt_brl(c['totalCobrado'])}, NFs={c['nfsEmitidas']}"
        for c in ciclos_historico
    )

    by_regiao: dict[str, dict] = {}
    for f in franqueados:
        key = f["estado"]
        if key not in by_regiao:
            by_regiao[key] = {"count": 0, "aberto": 0, "inadimplencia": []}
        by_regiao[key]["count"] += 1
        by_regiao[key]["aberto"] += f["valorAberto"]
        by_regiao[key]["inadimplencia"].append(f["inadimplencia"])

    regiao_detail = "\n".join(
        f"  - {uf}: {d['count']} franqueados, aberto={fmt_brl(d['aberto'])}, "
        f"inadimplência média={sum(d['inadimplencia'])/len(d['inadimplencia'])*100:.1f}%"
        for uf, d in by_regiao.items()
    )

    return f"""
=== DADOS DA REDE ===

FRANQUEADOS ({len(franqueados)} total):
- Saudável: {by_status['saudavel']} | Controlado: {by_status['controlado']} | Exige Atenção: {by_status['exigeAtencao']} | Crítico: {by_status['critico']}
- PMR médio: {pmr_medio}d | Emitido: {fmt_brl(total_emitido)} | Recebido: {fmt_brl(total_recebido)} | Aberto: {fmt_brl(total_aberto)}

DETALHE POR FRANQUEADO:
{todos}

FRANQUEADOS COM PROBLEMAS:
{criticos or '  Nenhum em situação crítica.'}

COBRANÇAS ({stats_cob['total']} total):
- Abertas: {stats_cob['byStatus']['aberta']} | Vencidas: {stats_cob['byStatus']['vencida']} ({fmt_brl(valor_vencido)}) | Pagas: {stats_cob['byStatus']['paga']}
- Taxa de recebimento: {stats_cob['taxaRecebimento']:.1f}%
- Royalties: {fmt_brl(stats_cob['byCategoria']['royalties'])} | FNP: {fmt_brl(stats_cob['byCategoria']['fnp'])}
- Boleto: {stats_cob['byFormaPagamento']['boleto']} | Pix: {stats_cob['byFormaPagamento']['pix']} | Cartão: {stats_cob['byFormaPagamento']['cartao']}

COBRANÇAS VENCIDAS (top 10):
{vencidas_detail or '  Nenhuma.'}

DISTRIBUIÇÃO REGIONAL:
{regiao_detail}

HISTÓRICO DE APURAÇÃO:
{apuracao_summary}
==="""


# Mock responses (fallback when no API key)
MOCK_RESPONSES = {
    "prioridade": {
        "reply": """**Ranking de cobrança por urgência:**

1. **Franquia Recife** — R$ 18.400 vencidos, **45 dias** de atraso, status Crítico. Maior valor absoluto e maior tempo sem pagamento — risco de virar inadimplência irrecuperável.
2. **Franquia Salvador** — R$ 22.000 em aberto, **67 dias** sem pagamento. Embora o valor seja maior, parte ainda está dentro do prazo; o vencido efetivo é R$ 14.200.
3. **Franquia Fortaleza** — R$ 8.900 vencidos, **3 cobranças consecutivas** atrasadas. Valor menor, mas o padrão de atrasos seguidos indica deterioração acelerada.

**Critério:** valor vencido × dias em atraso × tendência de piora. Recife pontua mais alto porque combina valor alto com atraso longo e sem sinal de regularização.""",
        "suggestions": [
            "Gerar script de cobrança para Recife",
            "Histórico de pagamentos Salvador",
            "Quais franquias estão regularizando?",
        ],
        "actions": [
            "navigate|/clientes/c9012345-6789-0123-2345-901234567890|Abrir ficha da Franquia Recife|Prioridade #1 — R$ 18.400 vencidos há 45 dias",
            "navigate|/cobrancas/nova|Criar cobrança para Recife|Iniciar cobrança formal do valor vencido",
        ],
    },
    "mudancas": {
        "reply": """**O que mudou na rede este mês:**

**Pioraram:**
- **Campo Belo** — PMR subiu **+87%** (de 8 para 15 dias), duas cobranças de Royalties em aberto totalizando R$ 24.000. Passou de Saudável para Exige Atenção.
- **Fortaleza** — 3 atrasos consecutivos, faturamento caiu **18%**. Padrão de deterioração acelerada.

**Melhoraram:**
- **Curitiba** — regularizou 2 cobranças vencidas (R$ 9.200), voltou para status Controlado.
- **Morumbi** — PMR caiu **20%** (de 25 para 20 dias), pagou adiantado 1 cobrança.

**Saldo líquido:** a rede piorou marginalmente — os R$ 24.000 de novas pendências de Campo Belo superam os R$ 9.200 regularizados por Curitiba. O alerta principal é Campo Belo, que saiu do radar saudável.""",
        "suggestions": [
            "Detalhar histórico Campo Belo",
            "O que causou a melhora de Curitiba?",
            "Tendência dos últimos 3 meses",
        ],
        "actions": [
            "navigate|/clientes/c4d5e6f7-8901-2345-def0-456789012345|Abrir ficha Campo Belo|PMR subiu 87% — requer acompanhamento",
            "notify|alerta-campo-belo|Criar alerta de acompanhamento|Monitorar Campo Belo nas próximas 2 semanas",
        ],
    },
    "comparar": {
        "reply": """**Comparativo regional — inadimplência e recuperação:**

| Região | Inadimplência média | PMR médio | Taxa recuperação |
|--------|-------------------|-----------|-----------------|
| **Nordeste (PE, CE, BA)** | **18,5%** | **42 dias** | **58%** |
| **Sudeste (SP)** | 6,2% | 18 dias | 89% |
| **Sul (PR)** | 8,1% | 22 dias | 82% |

**Destaque:** O Nordeste tem inadimplência **3x maior** que o Sudeste e taxa de recuperação **31 pontos** abaixo. O gap é puxado principalmente por Recife (45 dias de PMR) e Salvador (67 dias sem pagamento). Sudeste e Sul têm performance similar, com SP liderando em recuperação.

**Recomendação:** Criar régua de cobrança específica para o Nordeste, com gatilhos mais agressivos (D+5 ao invés de D+15) e canal preferencial WhatsApp.""",
        "suggestions": [
            "Detalhar franqueados do Nordeste",
            "Sugerir régua para Nordeste",
            "Evolução regional mês a mês",
        ],
        "actions": [
            "navigate|/clientes/c9012345-6789-0123-2345-901234567890|Abrir ficha Recife|Maior inadimplente do NE — PMR 45 dias",
            "navigate|/reguas|Configurar régua Nordeste|Criar régua específica com gatilhos D+5",
        ],
    },
    "previsao": {
        "reply": """**Previsão de recebimento — próximos 30 dias:**

- **Cenário base:** R$ 89.000 — considera taxa histórica de recebimento de 78% sobre cobranças em aberto e a vencer.
- **Cenário pessimista:** R$ 54.000 — se Salvador (R$ 22.000) e Fortaleza (R$ 8.900) não pagarem e Campo Belo atrasar novamente.

**Franquias-chave no horizonte:**
- **Morumbi** — R$ 32.000 a vencer, historicamente pontual (probabilidade alta)
- **Curitiba** — R$ 15.000 a vencer, acabou de regularizar (probabilidade média-alta)
- **Salvador** — R$ 22.000 em aberto, sem pagamento há 67 dias (probabilidade baixa)

**Risco principal:** Salvador sozinha responde pela diferença de R$ 35.000 entre os cenários. Uma renegociação parcial (50%) já elevaria o cenário pessimista para R$ 65.000.""",
        "suggestions": [
            "Simular renegociação com Salvador",
            "Projeção para 60 dias",
            "Quais cobranças vencem esta semana?",
        ],
        "actions": [
            "export|cobrancas-vencidas|Exportar cobranças vencidas|Planilha com vencidas para ação do financeiro",
            "navigate|/clientes/cb234567-8901-2345-4567-123456789012|Abrir ficha Salvador|R$ 22.000 em aberto — maior risco da projeção",
        ],
    },
}


def get_mock_response(message: str) -> dict:
    lower = message.lower()
    if "cobrar primeiro" in lower or "priorid" in lower:
        return MOCK_RESPONSES["prioridade"]
    if "mudou" in lower or "mudança" in lower or "este mês" in lower:
        return MOCK_RESPONSES["mudancas"]
    if "compar" in lower or "região" in lower or "regiões" in lower:
        return MOCK_RESPONSES["comparar"]
    if "previsão" in lower or "previs" in lower or "próximos" in lower:
        return MOCK_RESPONSES["previsao"]
    return MOCK_RESPONSES["prioridade"]


# Mia mock responses
MIA_MOCK_RESPONSES = {
    "dividas": """**Resumo**
Você tem 3 clientes em situação de atenção imediata, totalizando R$ 47.500 em risco.

**Insights**
- Cliente "Franquia Recife" está há 120 dias em atraso com R$ 28.500 (maior risco)
- 2 clientes ultrapassaram 60 dias de atraso esta semana
- Taxa de recuperação caiu 8% no último mês

**Próximas ações**
1. Acesse /dividas e priorize o contato com Franquia Recife
2. Configure uma régua específica para inadimplentes em /reguas
3. Considere oferecer parcelamento para valores acima de R$ 10.000""",
    "receita": """**Resumo**
Sua receita cresceu 12% nos últimos 30 dias, atingindo R$ 72.000.

**Insights**
- Pix representa 35% das transações (crescimento de 15% vs mês anterior)
- Boleto ainda domina com 52% do volume
- Ticket médio subiu de R$ 2.800 para R$ 3.100

**Próximas ações**
1. Incentive mais pagamentos via Pix para reduzir custos
2. Revise a estratégia de desconto para pagamentos antecipados
3. Acesse /emissao para ver a distribuição detalhada""",
    "risco": """**Resumo**
5 clientes apresentam risco elevado de atraso baseado no histórico recente.

**Insights**
- Score médio de risco dos top 5: 78%
- Padrão comum: atrasos começam após 2ª cobrança
- Concentração: 3 dos 5 são do mesmo segmento

**Próximas ações**
1. Ative lembretes proativos 3 dias antes do vencimento
2. Configure a régua em /reguas para envio automático
3. Analise o perfil desses clientes em /clientes""",
    "regua": """**Resumo**
Sua régua atual tem 4 passos, mas pode ser otimizada para pagadores duvidosos.

**Insights**
- Clientes que recebem WhatsApp no D-1 pagam 23% mais em dia
- E-mail no D+3 tem taxa de abertura de apenas 18%
- Ligação no D+15 recupera 45% dos casos

**Próximas ações**
1. Adicione um passo de WhatsApp em D-1 para todos
2. Substitua e-mail D+3 por SMS (maior taxa de leitura)
3. Acesse /reguas para implementar essas mudanças""",
    "default": """**Resumo**
Sua operação está saudável. Veja os destaques do momento.

**Insights**
- R$ 163.000 em receita no último mês
- Taxa de recebimento em 78% (meta: 80%)
- 3 cobranças vencem esta semana

**Próximas ações**
1. Monitore as cobranças próximas do vencimento em /cobrancas
2. Revise clientes com potencial de atraso em /dividas
3. Emita novas cobranças pendentes em /emissao""",
}


def get_mia_mock_response(message: str) -> str:
    lower = message.lower()
    if any(w in lower for w in ("dívida", "atenção", "inadimpl")):
        return MIA_MOCK_RESPONSES["dividas"]
    if any(w in lower for w in ("receita", "mudou", "faturamento")):
        return MIA_MOCK_RESPONSES["receita"]
    if any(w in lower for w in ("risco", "atraso", "cliente")):
        return MIA_MOCK_RESPONSES["risco"]
    if any(w in lower for w in ("régua", "regua", "ajuste", "pagadores")):
        return MIA_MOCK_RESPONSES["regua"]
    return MIA_MOCK_RESPONSES["default"]
