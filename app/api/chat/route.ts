import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
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
- /clientes/ID → página do franqueado
- /reguas → configuração de réguas de cobrança
- /cobrancas → lista de cobranças
- /cobrancas/nova → criar nova cobrança

Tipos de export disponíveis:
- cobrancas-vencidas → exporta cobranças vencidas

Use ações que façam sentido para os insights apresentados. Sempre inclua pelo menos 2 ações.`;

// ── Build data context from real Prisma data ──

async function buildDataContext(franqueadoraId: string): Promise<string> {
  const fmtBRL = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  // Fetch customers with charges
  const customers = await prisma.customer.findMany({
    where: { franqueadoraId },
    include: { charges: true },
  });

  // Fetch all charges
  const charges = await prisma.charge.findMany({
    where: { customer: { franqueadoraId } },
    include: { customer: true },
  });

  if (customers.length === 0 && charges.length === 0) {
    return "\n=== DADOS DA REDE ===\nNenhum dado cadastrado ainda. A rede ainda não possui franqueados ou cobranças registradas.\n===";
  }

  // Customer metrics
  const customerMetrics = customers.map((c) => {
    const custCharges = charges.filter((ch) => ch.customerId === c.id);
    const emitido = custCharges.reduce((s, ch) => s + ch.amountCents, 0);
    const recebido = custCharges.filter((ch) => ch.status === "PAID").reduce((s, ch) => s + ch.amountCents, 0);
    const aberto = custCharges.filter((ch) => ch.status === "PENDING" || ch.status === "OVERDUE").reduce((s, ch) => s + ch.amountCents, 0);
    const inadimplencia = emitido > 0 ? aberto / emitido : 0;
    const vencidas = custCharges.filter((ch) => ch.status === "OVERDUE").length;

    // PMR
    const pagas = custCharges.filter((ch) => ch.status === "PAID" && ch.paidAt);
    const pmrDays = pagas.length > 0
      ? Math.round(pagas.reduce((s, ch) => {
          const diff = (ch.paidAt!.getTime() - ch.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return s + diff;
        }, 0) / pagas.length)
      : 0;

    // Status
    let status = "Saudável";
    if (inadimplencia > 0.3) status = "Crítico";
    else if (inadimplencia > 0.15) status = "Exige Atenção";
    else if (inadimplencia > 0.05) status = "Controlado";

    return {
      nome: c.name,
      id: c.id,
      cidade: c.cidade || "—",
      estado: c.estado || "—",
      status,
      pmr: pmrDays,
      inadimplencia,
      emitido,
      recebido,
      aberto,
      vencidas,
    };
  });

  const totalEmitido = customerMetrics.reduce((s, c) => s + c.emitido, 0);
  const totalRecebido = customerMetrics.reduce((s, c) => s + c.recebido, 0);
  const totalAberto = customerMetrics.reduce((s, c) => s + c.aberto, 0);
  const pmrMedio = customerMetrics.length > 0
    ? Math.round(customerMetrics.reduce((s, c) => s + c.pmr, 0) / customerMetrics.length)
    : 0;

  const byStatus = {
    saudavel: customerMetrics.filter((c) => c.status === "Saudável").length,
    controlado: customerMetrics.filter((c) => c.status === "Controlado").length,
    exigeAtencao: customerMetrics.filter((c) => c.status === "Exige Atenção").length,
    critico: customerMetrics.filter((c) => c.status === "Crítico").length,
  };

  const todosFranqueados = customerMetrics
    .map((c) => `  - ${c.nome} (${c.cidade}/${c.estado}): status=${c.status}, PMR=${c.pmr}d, inadimplência=${(c.inadimplencia * 100).toFixed(1)}%, emitido=${fmtBRL(c.emitido)}, recebido=${fmtBRL(c.recebido)}, aberto=${fmtBRL(c.aberto)}`)
    .join("\n");

  const criticos = customerMetrics
    .filter((c) => c.status === "Crítico" || c.status === "Exige Atenção")
    .map((c) => `  - ${c.nome} (${c.cidade}/${c.estado}): status=${c.status}, PMR=${c.pmr}d, inadimplência=${(c.inadimplencia * 100).toFixed(1)}%, aberto=${fmtBRL(c.aberto)}`)
    .join("\n");

  // Charge stats
  const totalCharges = charges.length;
  const abertasCount = charges.filter((c) => c.status === "PENDING").length;
  const vencidasCount = charges.filter((c) => c.status === "OVERDUE").length;
  const pagasCount = charges.filter((c) => c.status === "PAID").length;
  const valorVencido = charges.filter((c) => c.status === "OVERDUE").reduce((s, c) => s + c.amountCents, 0);
  const taxaRecebimento = totalCharges > 0 ? (pagasCount / totalCharges) * 100 : 0;

  const vencidasDetail = charges
    .filter((c) => c.status === "OVERDUE")
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 10)
    .map((c) => `  - ${c.customer?.name ?? "—"}: ${c.description} — ${fmtBRL(c.amountCents)} (venc. ${c.dueDate.toISOString().slice(0, 10)})`)
    .join("\n");

  // Regional distribution
  const byRegiao: Record<string, { count: number; aberto: number; inadimplencia: number[] }> = {};
  customerMetrics.forEach((c) => {
    const key = c.estado;
    if (key === "—") return;
    if (!byRegiao[key]) byRegiao[key] = { count: 0, aberto: 0, inadimplencia: [] };
    byRegiao[key].count++;
    byRegiao[key].aberto += c.aberto;
    byRegiao[key].inadimplencia.push(c.inadimplencia);
  });
  const regiaoDetail = Object.entries(byRegiao)
    .map(([uf, data]) => {
      const inadMedia = (data.inadimplencia.reduce((s, v) => s + v, 0) / data.inadimplencia.length * 100).toFixed(1);
      return `  - ${uf}: ${data.count} franqueados, aberto=${fmtBRL(data.aberto)}, inadimplência média=${inadMedia}%`;
    })
    .join("\n");

  return `
=== DADOS DA REDE ===

FRANQUEADOS (${customers.length} total):
- Saudável: ${byStatus.saudavel} | Controlado: ${byStatus.controlado} | Exige Atenção: ${byStatus.exigeAtencao} | Crítico: ${byStatus.critico}
- PMR médio: ${pmrMedio}d | Emitido: ${fmtBRL(totalEmitido)} | Recebido: ${fmtBRL(totalRecebido)} | Aberto: ${fmtBRL(totalAberto)}

DETALHE POR FRANQUEADO:
${todosFranqueados || "  Nenhum franqueado cadastrado."}

FRANQUEADOS COM PROBLEMAS:
${criticos || "  Nenhum em situação crítica."}

COBRANÇAS (${totalCharges} total):
- Abertas: ${abertasCount} | Vencidas: ${vencidasCount} (${fmtBRL(valorVencido)}) | Pagas: ${pagasCount}
- Taxa de recebimento: ${taxaRecebimento.toFixed(1)}%

COBRANÇAS VENCIDAS (top 10):
${vencidasDetail || "  Nenhuma."}

DISTRIBUIÇÃO REGIONAL:
${regiaoDetail || "  Sem dados regionais."}
===`;
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
  const { session, error } = await requireTenant();
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
    const franqueadoraId = session!.user.franqueadoraId ?? "";
    const dataContext = await buildDataContext(franqueadoraId);
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
                // Fallback: send error message
                controller.enqueue(
                  sseEvent(JSON.stringify({ text: "Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente." }))
                );
              }
              controller.enqueue(sseEvent("[DONE]"));
              controller.close();
            },
          });

          return new Response(readableStream, { headers: sseHeaders() });
        } catch {
          // Fall through to fallback
        }
      }

      // Fallback when no API key
      const fallbackText = "Para usar a Júlia IA, configure a variável ANTHROPIC_API_KEY no ambiente.\n\n<<SUGESTÕES>>\nComo configurar a API?\nQuais funcionalidades tenho?\nComo cadastrar franqueados?";
      const words = fallbackText.split(" ");

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

    // Fallback when no API key
    return NextResponse.json({
      reply: "Para usar a Júlia IA, configure a variável ANTHROPIC_API_KEY no ambiente.",
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
