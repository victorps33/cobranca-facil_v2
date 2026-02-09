import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { franqueadosDummy } from "@/lib/data/clientes-dummy";
import { cobrancasDummy, getCobrancasStats } from "@/lib/data/cobrancas-dummy";
import { ciclosHistorico } from "@/lib/data/apuracao-historico-dummy";
import { requireTenant } from "@/lib/auth-helpers";

// ── Anthropic client ──

function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith("sk-ant-your")) return null;
  return new Anthropic({ apiKey: key });
}

// ── System prompt ──

const JULIA_SYSTEM_PROMPT = `Você é Júlia, a Agente Menlo IA — analista de dados especializada em redes de franquias e gestão de cobranças.

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
<sugestão ou pergunta para continuar>`;

const SUGGESTIONS_INSTRUCTION = `

IMPORTANTE: Ao final da sua resposta, após uma linha em branco, adicione exatamente 3 sugestões curtas de follow-up (máx 50 caracteres cada) neste formato exato:
<<SUGESTÕES>>
Sugestão curta 1
Sugestão curta 2
Sugestão curta 3`;

const ACTIONS_INSTRUCTION = `

Após as sugestões, inclua um plano de ação executável com 2-4 ações concretas:
<<AÇÕES>>
tipo|parametro|rotulo|descricao

Tipos disponíveis:
- navigate|/rota-do-app|Rótulo da ação|Descrição curta
- export|tipo-de-export|Rótulo da ação|Descrição curta
- notify|id-notificacao|Rótulo da ação|Descrição curta

Rotas disponíveis para navigate:
- /clientes/ID → página do franqueado (IDs: c1a2b3c4-d5e6-7890-abcd-ef1234567890 para Morumbi, c9012345-6789-0123-2345-901234567890 para Recife, ca123456-7890-1234-3456-012345678901 para Fortaleza, cb234567-8901-2345-4567-123456789012 para Salvador, cc345678-9012-3456-5678-234567890123 para Curitiba, c4d5e6f7-8901-2345-def0-456789012345 para Campo Belo)
- /reguas → configuração de réguas de cobrança
- /cobrancas → lista de cobranças
- /cobrancas/nova → criar nova cobrança

Tipos de export disponíveis:
- cobrancas-vencidas → exporta cobranças vencidas

Use ações que façam sentido para os insights apresentados. Sempre inclua pelo menos 2 ações.`;

// ── Build data context for the AI ──

function buildDataContext(): string {
  const stats = getCobrancasStats(cobrancasDummy);

  const fmtBRL = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const franqueados = franqueadosDummy;
  const franqueadosByStatus = {
    saudavel: franqueados.filter((f) => f.status === "Saudável").length,
    controlado: franqueados.filter((f) => f.status === "Controlado").length,
    exigeAtencao: franqueados.filter((f) => f.status === "Exige Atenção").length,
    critico: franqueados.filter((f) => f.status === "Crítico").length,
  };
  const pmrMedio = Math.round(franqueados.reduce((s, f) => s + f.pmr, 0) / franqueados.length);
  const totalAberto = franqueados.reduce((s, f) => s + f.valorAberto, 0);
  const totalEmitido = franqueados.reduce((s, f) => s + f.valorEmitido, 0);
  const totalRecebido = franqueados.reduce((s, f) => s + f.valorRecebido, 0);

  const criticos = franqueados
    .filter((f) => f.status === "Crítico" || f.status === "Exige Atenção")
    .map((f) => `  - ${f.nome} (${f.cidade}/${f.estado}): status=${f.status}, PMR=${f.pmr}d, inadimplência=${(f.inadimplencia * 100).toFixed(1)}%, aberto=${fmtBRL(f.valorAberto)}`)
    .join("\n");

  const todosFranqueados = franqueados
    .map((f) => `  - ${f.nome} (${f.cidade}/${f.estado}): status=${f.status}, PMR=${f.pmr}d, inadimplência=${(f.inadimplencia * 100).toFixed(1)}%, emitido=${fmtBRL(f.valorEmitido)}, recebido=${fmtBRL(f.valorRecebido)}, aberto=${fmtBRL(f.valorAberto)}`)
    .join("\n");

  const vencidas = cobrancasDummy.filter((c) => c.status === "Vencida");
  const valorVencido = vencidas.reduce((s, c) => s + c.valorAberto, 0);
  const vencidasDetail = vencidas
    .sort((a, b) => b.valorAberto - a.valorAberto)
    .slice(0, 10)
    .map((c) => `  - ${c.cliente}: ${c.descricao} — ${fmtBRL(c.valorAberto)} (venc. ${c.dataVencimento})`)
    .join("\n");

  const apuracaoSummary = ciclosHistorico
    .map((c) => `  - ${c.competencia}: ${c.franqueados} franqueados, fat=${fmtBRL(c.faturamentoTotal)}, cobrado=${fmtBRL(c.totalCobrado)}, NFs=${c.nfsEmitidas}`)
    .join("\n");

  const byRegiao: Record<string, { count: number; aberto: number; inadimplencia: number[] }> = {};
  franqueados.forEach((f) => {
    const key = f.estado;
    if (!byRegiao[key]) byRegiao[key] = { count: 0, aberto: 0, inadimplencia: [] };
    byRegiao[key].count++;
    byRegiao[key].aberto += f.valorAberto;
    byRegiao[key].inadimplencia.push(f.inadimplencia);
  });
  const regiaoDetail = Object.entries(byRegiao)
    .map(([uf, data]) => {
      const inadMedia = (data.inadimplencia.reduce((s, v) => s + v, 0) / data.inadimplencia.length * 100).toFixed(1);
      return `  - ${uf}: ${data.count} franqueados, aberto=${fmtBRL(data.aberto)}, inadimplência média=${inadMedia}%`;
    })
    .join("\n");

  return `
=== DADOS DA REDE ===

FRANQUEADOS (${franqueados.length} total):
- Saudável: ${franqueadosByStatus.saudavel} | Controlado: ${franqueadosByStatus.controlado} | Exige Atenção: ${franqueadosByStatus.exigeAtencao} | Crítico: ${franqueadosByStatus.critico}
- PMR médio: ${pmrMedio}d | Emitido: ${fmtBRL(totalEmitido)} | Recebido: ${fmtBRL(totalRecebido)} | Aberto: ${fmtBRL(totalAberto)}

DETALHE POR FRANQUEADO:
${todosFranqueados}

FRANQUEADOS COM PROBLEMAS:
${criticos || "  Nenhum em situação crítica."}

COBRANÇAS (${stats.total} total):
- Abertas: ${stats.byStatus.aberta} | Vencidas: ${stats.byStatus.vencida} (${fmtBRL(valorVencido)}) | Pagas: ${stats.byStatus.paga}
- Taxa de recebimento: ${stats.taxaRecebimento.toFixed(1)}%
- Royalties: ${fmtBRL(stats.byCategoria.royalties)} | FNP: ${fmtBRL(stats.byCategoria.fnp)}
- Boleto: ${stats.byFormaPagamento.boleto} | Pix: ${stats.byFormaPagamento.pix} | Cartão: ${stats.byFormaPagamento.cartao}

COBRANÇAS VENCIDAS (top 10):
${vencidasDetail || "  Nenhuma."}

DISTRIBUIÇÃO REGIONAL:
${regiaoDetail}

HISTÓRICO DE APURAÇÃO:
${apuracaoSummary}
===`;
}

// ── Mock responses (fallback) ──

interface MockResponse {
  reply: string;
  suggestions: string[];
  actions: string[];
}

const mocks: Record<string, MockResponse> = {
  prioridade: {
    reply: `**Ranking de cobrança por urgência:**

1. **Franquia Recife** — R$ 18.400 vencidos, **45 dias** de atraso, status Crítico. Maior valor absoluto e maior tempo sem pagamento — risco de virar inadimplência irrecuperável.
2. **Franquia Salvador** — R$ 22.000 em aberto, **67 dias** sem pagamento. Embora o valor seja maior, parte ainda está dentro do prazo; o vencido efetivo é R$ 14.200.
3. **Franquia Fortaleza** — R$ 8.900 vencidos, **3 cobranças consecutivas** atrasadas. Valor menor, mas o padrão de atrasos seguidos indica deterioração acelerada.

**Critério:** valor vencido × dias em atraso × tendência de piora. Recife pontua mais alto porque combina valor alto com atraso longo e sem sinal de regularização.`,
    suggestions: [
      "Gerar script de cobrança para Recife",
      "Histórico de pagamentos Salvador",
      "Quais franquias estão regularizando?",
    ],
    actions: [
      "navigate|/clientes/c9012345-6789-0123-2345-901234567890|Abrir ficha da Franquia Recife|Prioridade #1 — R$ 18.400 vencidos há 45 dias",
      "navigate|/cobrancas/nova|Criar cobrança para Recife|Iniciar cobrança formal do valor vencido",
    ],
  },
  mudancas: {
    reply: `**O que mudou na rede este mês:**

**Pioraram:**
- **Campo Belo** — PMR subiu **+87%** (de 8 para 15 dias), duas cobranças de Royalties em aberto totalizando R$ 24.000. Passou de Saudável para Exige Atenção.
- **Fortaleza** — 3 atrasos consecutivos, faturamento caiu **18%**. Padrão de deterioração acelerada.

**Melhoraram:**
- **Curitiba** — regularizou 2 cobranças vencidas (R$ 9.200), voltou para status Controlado.
- **Morumbi** — PMR caiu **20%** (de 25 para 20 dias), pagou adiantado 1 cobrança.

**Saldo líquido:** a rede piorou marginalmente — os R$ 24.000 de novas pendências de Campo Belo superam os R$ 9.200 regularizados por Curitiba. O alerta principal é Campo Belo, que saiu do radar saudável.`,
    suggestions: [
      "Detalhar histórico Campo Belo",
      "O que causou a melhora de Curitiba?",
      "Tendência dos últimos 3 meses",
    ],
    actions: [
      "navigate|/clientes/c4d5e6f7-8901-2345-def0-456789012345|Abrir ficha Campo Belo|PMR subiu 87% — requer acompanhamento",
      "notify|alerta-campo-belo|Criar alerta de acompanhamento|Monitorar Campo Belo nas próximas 2 semanas",
    ],
  },
  comparar: {
    reply: `**Comparativo regional — inadimplência e recuperação:**

| Região | Inadimplência média | PMR médio | Taxa recuperação |
|--------|-------------------|-----------|-----------------|
| **Nordeste (PE, CE, BA)** | **18,5%** | **42 dias** | **58%** |
| **Sudeste (SP)** | 6,2% | 18 dias | 89% |
| **Sul (PR)** | 8,1% | 22 dias | 82% |

**Destaque:** O Nordeste tem inadimplência **3x maior** que o Sudeste e taxa de recuperação **31 pontos** abaixo. O gap é puxado principalmente por Recife (45 dias de PMR) e Salvador (67 dias sem pagamento). Sudeste e Sul têm performance similar, com SP liderando em recuperação.

**Recomendação:** Criar régua de cobrança específica para o Nordeste, com gatilhos mais agressivos (D+5 ao invés de D+15) e canal preferencial WhatsApp.`,
    suggestions: [
      "Detalhar franqueados do Nordeste",
      "Sugerir régua para Nordeste",
      "Evolução regional mês a mês",
    ],
    actions: [
      "navigate|/clientes/c9012345-6789-0123-2345-901234567890|Abrir ficha Recife|Maior inadimplente do NE — PMR 45 dias",
      "navigate|/reguas|Configurar régua Nordeste|Criar régua específica com gatilhos D+5",
    ],
  },
  previsao: {
    reply: `**Previsão de recebimento — próximos 30 dias:**

- **Cenário base:** R$ 89.000 — considera taxa histórica de recebimento de 78% sobre cobranças em aberto e a vencer.
- **Cenário pessimista:** R$ 54.000 — se Salvador (R$ 22.000) e Fortaleza (R$ 8.900) não pagarem e Campo Belo atrasar novamente.

**Franquias-chave no horizonte:**
- **Morumbi** — R$ 32.000 a vencer, historicamente pontual (probabilidade alta)
- **Curitiba** — R$ 15.000 a vencer, acabou de regularizar (probabilidade média-alta)
- **Salvador** — R$ 22.000 em aberto, sem pagamento há 67 dias (probabilidade baixa)

**Risco principal:** Salvador sozinha responde pela diferença de R$ 35.000 entre os cenários. Uma renegociação parcial (50%) já elevaria o cenário pessimista para R$ 65.000.`,
    suggestions: [
      "Simular renegociação com Salvador",
      "Projeção para 60 dias",
      "Quais cobranças vencem esta semana?",
    ],
    actions: [
      "export|cobrancas-vencidas|Exportar cobranças vencidas|Planilha com vencidas para ação do financeiro",
      "navigate|/clientes/cb234567-8901-2345-4567-123456789012|Abrir ficha Salvador|R$ 22.000 em aberto — maior risco da projeção",
    ],
  },
};

function getMockResponse(message: string): MockResponse {
  const lower = message.toLowerCase();
  if (lower.includes("cobrar primeiro") || lower.includes("priorid")) return mocks.prioridade;
  if (lower.includes("mudou") || lower.includes("mudança") || lower.includes("este mês")) return mocks.mudancas;
  if (lower.includes("compar") || lower.includes("região") || lower.includes("regiões")) return mocks.comparar;
  if (lower.includes("previsão") || lower.includes("previs") || lower.includes("próximos")) return mocks.previsao;
  return mocks.prioridade;
}

// ── SSE helpers ──

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}

const encoder = new TextEncoder();

function sseEvent(data: string): Uint8Array {
  return encoder.encode(`data: ${data}\n\n`);
}

// ── POST handler ──

export async function POST(request: Request) {
  const { error } = await requireTenant();
  if (error) return error;

  try {
    const body = await request.json();
    const {
      messages: conversationMessages,
      message,
      stream: isStreaming = false,
      detailLevel = "resumido",
    } = body;

    // Build Claude messages from history or single message
    const claudeMessages: { role: "user" | "assistant"; content: string }[] =
      conversationMessages
        ? conversationMessages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        : message
          ? [{ role: "user" as const, content: message }]
          : [];

    const lastUserMessage =
      claudeMessages.length > 0
        ? claudeMessages[claudeMessages.length - 1].content
        : "";

    if (!lastUserMessage) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const anthropic = getAnthropicClient();
    const dataContext = buildDataContext();
    const includeSuggestions = isStreaming;

    const detailInstruction = detailLevel === "detalhado"
      ? "\n\n**NÍVEL DE DETALHE: DETALHADO** — Seja completo e aprofundado. Até 500 palavras. Inclua análise detalhada, contexto histórico, comparações e recomendações estratégicas com justificativa."
      : "\n\n**NÍVEL DE DETALHE: RESUMIDO** — Seja extremamente conciso e direto. Máximo 150 palavras. Apenas os pontos essenciais e números-chave.";

    const systemPrompt =
      JULIA_SYSTEM_PROMPT +
      detailInstruction +
      "\n\n" +
      dataContext +
      (includeSuggestions ? SUGGESTIONS_INSTRUCTION + ACTIONS_INSTRUCTION : "");

    // ── Streaming mode ──
    if (isStreaming) {
      if (anthropic) {
        try {
          const readableStream = new ReadableStream({
            async start(controller) {
              try {
                const stream = await anthropic.messages.create({
                  model: "claude-haiku-4-5-20251001",
                  max_tokens: 1024,
                  system: systemPrompt,
                  messages: claudeMessages,
                  stream: true,
                });

                for await (const event of stream) {
                  if (
                    event.type === "content_block_delta" &&
                    event.delta.type === "text_delta"
                  ) {
                    controller.enqueue(
                      sseEvent(JSON.stringify({ text: event.delta.text }))
                    );
                  }
                }
              } catch {
                // Fallback: stream mock word-by-word
                const mock = getMockResponse(lastUserMessage);
                const fullText =
                  mock.reply +
                  "\n\n<<SUGESTÕES>>\n" +
                  mock.suggestions.join("\n") +
                  "\n<<AÇÕES>>\n" +
                  mock.actions.join("\n");
                const words = fullText.split(" ");
                for (let i = 0; i < words.length; i++) {
                  const text = (i === 0 ? "" : " ") + words[i];
                  controller.enqueue(sseEvent(JSON.stringify({ text })));
                  await new Promise((r) => setTimeout(r, 20));
                }
              }
              controller.enqueue(sseEvent("[DONE]"));
              controller.close();
            },
          });

          return new Response(readableStream, { headers: sseHeaders() });
        } catch {
          // Fall through to mock streaming
        }
      }

      // Mock streaming (no API key)
      const mock = getMockResponse(lastUserMessage);
      const fullText =
        mock.reply + "\n\n<<SUGESTÕES>>\n" + mock.suggestions.join("\n") +
        "\n<<AÇÕES>>\n" + mock.actions.join("\n");
      const words = fullText.split(" ");

      const readableStream = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < words.length; i++) {
            const text = (i === 0 ? "" : " ") + words[i];
            controller.enqueue(sseEvent(JSON.stringify({ text })));
            await new Promise((r) => setTimeout(r, 20));
          }
          controller.enqueue(sseEvent("[DONE]"));
          controller.close();
        },
      });

      return new Response(readableStream, { headers: sseHeaders() });
    }

    // ── Non-streaming mode (card pre-loading) ──
    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: systemPrompt,
          messages: claudeMessages,
        });

        const textContent = response.content.find((c) => c.type === "text");
        const reply = textContent?.text ?? "";
        if (reply) return NextResponse.json({ reply });
      } catch (err) {
        console.error("Anthropic API error in chat:", err);
      }
    }

    // Mock fallback — include actions so frontend can parse them
    const mockFallback = getMockResponse(lastUserMessage);
    const fallbackReply =
      mockFallback.reply +
      "\n\n<<AÇÕES>>\n" +
      mockFallback.actions.join("\n");
    return NextResponse.json({ reply: fallbackReply });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
