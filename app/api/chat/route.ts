import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { franqueadosDummy } from "@/lib/data/clientes-dummy";
import { cobrancasDummy, getCobrancasStats } from "@/lib/data/cobrancas-dummy";
import { ciclosHistorico } from "@/lib/data/apuracao-historico-dummy";

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
}

const mocks: Record<string, MockResponse> = {
  inadimplencia: {
    reply: `**Resumo**
A inadimplência está concentrada principalmente na região Nordeste e em franqueados com menos de 2 anos de operação.

**Insights**
- **R$ 47.500** em valores vencidos há mais de 60 dias
- 3 franqueados representam **68%** do total inadimplente
- Perfil de risco alto concentra 5 unidades na região Nordeste
- Taxa de recuperação caiu 12% no último trimestre

**Ações recomendadas**
1. Priorize contato com os 3 maiores inadimplentes esta semana
2. Ative régua de cobrança intensiva para perfil de risco alto
3. Considere renegociação com parcelamento para valores acima de R$ 10.000

**Próximo passo**
Quer que eu detalhe o perfil de cada franqueado inadimplente ou prefere ver as opções de régua de cobrança?`,
    suggestions: [
      "Detalhar os 3 maiores inadimplentes",
      "Simular cenário de recuperação",
      "Sugerir régua de cobrança",
    ],
  },
  piorando: {
    reply: `**Resumo**
Identificamos 5 franqueados com tendência de piora nos últimos 3 meses, com aumento médio de 34% nos dias de atraso.

**Insights**
- **Franquia Recife** passou de 15 para 45 dias médios de atraso
- **Franquia Fortaleza** teve 3 cobranças consecutivas atrasadas
- Padrão comum: problemas começam após 2ª cobrança do mês
- 80% dos casos têm correlação com queda no faturamento local

**Ações recomendadas**
1. Agende reunião com os 2 franqueados mais críticos
2. Ofereça consultoria financeira como suporte
3. Revise condições de pagamento caso a caso

**Próximo passo**
Posso gerar um relatório detalhado de cada franqueado ou prefere que eu sugira um script de abordagem para a reunião?`,
    suggestions: [
      "Gerar relatório da Franquia Recife",
      "Script de abordagem para reunião",
      "Comparar com trimestre anterior",
    ],
  },
  efetividade: {
    reply: `**Resumo**
Sua taxa de recebimento está em **78%**, abaixo da meta de 85%. O PMR médio é de 28 dias.

**Insights**
- Cobranças via **Pix** têm PMR de 3 dias (melhor performance)
- Boleto tem PMR de 18 dias e taxa de conversão de 72%
- Clientes com score alto pagam em média 5 dias antes
- Régua de WhatsApp D-1 aumenta conversão em 23%

**Ações recomendadas**
1. Incentive migração para Pix com desconto de 2%
2. Ative lembrete WhatsApp D-1 para todos os perfis
3. Crie régua específica para boletos não pagos em D+3

**Próximo passo**
Quer que eu simule o impacto financeiro dessas mudanças ou prefere ver a distribuição por forma de pagamento?`,
    suggestions: [
      "Simular impacto da migração para Pix",
      "Ver distribuição por forma de pagamento",
      "Otimizar régua de WhatsApp",
    ],
  },
  risco: {
    reply: `**Resumo**
O risco financeiro total da rede é de **R$ 127.000**, com potencial de perda de R$ 55.000 baseado no score de risco.

**Insights**
- **3 franqueados** concentram 65% do risco total
- Cenário otimista: recuperação de 70% em 90 dias
- Cenário pessimista: perda de 43% se não houver ação
- Provisão recomendada: R$ 38.000 (30% do total em risco)

**Ações recomendadas**
1. Inicie processo de protesto para valores acima de R$ 20.000 e +90 dias
2. Negocie acordo com garantia para os 3 maiores devedores
3. Atualize provisão de perdas no próximo fechamento

**Próximo passo**
Posso detalhar os cenários de recuperação ou gerar o relatório para o financeiro?`,
    suggestions: [
      "Detalhar cenários de recuperação",
      "Gerar relatório para o financeiro",
      "Listar os 3 maiores devedores",
    ],
  },
};

function getMockResponse(message: string): MockResponse {
  const lower = message.toLowerCase();
  if (lower.includes("inadimpl") || lower.includes("concentra")) return mocks.inadimplencia;
  if (lower.includes("piora") || lower.includes("tendência")) return mocks.piorando;
  if (lower.includes("efetiv") || lower.includes("cobrança") || lower.includes("pmr")) return mocks.efetividade;
  if (lower.includes("risco") || lower.includes("exposição") || lower.includes("recuperação")) return mocks.risco;
  return mocks.inadimplencia;
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
  try {
    const body = await request.json();
    const {
      messages: conversationMessages,
      message,
      stream: isStreaming = false,
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
    const systemPrompt =
      JULIA_SYSTEM_PROMPT +
      "\n\n" +
      dataContext +
      (includeSuggestions ? SUGGESTIONS_INSTRUCTION : "");

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
                  mock.suggestions.join("\n");
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
        mock.reply + "\n\n<<SUGESTÕES>>\n" + mock.suggestions.join("\n");
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

    // Mock fallback
    return NextResponse.json({ reply: getMockResponse(lastUserMessage).reply });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
