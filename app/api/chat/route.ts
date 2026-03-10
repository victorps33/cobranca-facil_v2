import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";
import { createHash } from "crypto";

// ── Anthropic client ──

function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith("sk-ant-your")) return null;
  return new Anthropic({ apiKey: key });
}

// ── Anonymization ──

function anonymizeContext(text: string): string {
  return text
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, "[CPF]")
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, "[CNPJ]")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/g, "[tel]");
}

// ── Rate limiting (in-memory) ──

const RATE_LIMIT = 30; // messages per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= RATE_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

// ── Response caching for presets ──

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const responseCache = new Map<string, { response: string; timestamp: number }>();

const KNOWN_PRESET_QUESTIONS = [
  "Quem eu devo cobrar primeiro?",
  "O que mudou na minha rede este mês?",
  "Compare a inadimplência e recuperação por região",
  "Qual a previsão de recebimento para os próximos 30 dias?",
  "Onde está concentrada a inadimplência na minha rede?",
  "Qual a efetividade das minhas cobranças?",
];

function isPresetQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return KNOWN_PRESET_QUESTIONS.some((q) => lower.includes(q.toLowerCase().slice(0, 30)));
}

function getCacheKey(message: string, franqueadoraId: string, detailLevel: string): string {
  const hash = createHash("md5").update(`${message}:${franqueadoraId}:${detailLevel}`).digest("hex");
  return hash;
}

function getCachedResponse(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    responseCache.delete(key);
    return null;
  }
  return entry.response;
}

function setCachedResponse(key: string, response: string): void {
  responseCache.set(key, { response, timestamp: Date.now() });
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

const MULTI_SUBSIDIARY_INSTRUCTION = `

Quando os dados contêm múltiplas subsidiárias:
- Identifique cada subsidiária pelo nome
- Permita comparações diretas entre elas (ex: inadimplência, PMR, recebimentos)
- Na visão consolidada, apresente totais gerais E quebra por subsidiária
- Se perguntarem sobre uma subsidiária específica, foque nela`;

const CAMPAIGN_SYSTEM_PROMPT = `Você é a assistente de criação de campanhas de negociação da Menlo.

**Seu papel:** Guiar o usuário na criação de uma campanha de renegociação de dívidas, passo a passo.

**Dados disponíveis abaixo:** cobranças pendentes, perfis de risco, métricas de inadimplência.

**Ao iniciar a conversa:**
1. Analise os dados e sugira 3 campanhas baseadas na situação real das dívidas
2. Cada sugestão deve ter: nome, público-alvo, condições comerciais sugeridas

**Durante a conversa, defina com o usuário:**
- Nome da campanha
- Período (startDate e endDate)
- Condições comerciais: desconto à vista (maxCashDiscount, ex: 0.15 = 15%), parcelas máximas (maxInstallments), juros mensais (monthlyInterestRate, ex: 0.02 = 2%), parcela mínima em centavos (minInstallmentCents, ex: 5000 = R$50)
- Público-alvo (filtros: dias de atraso mínimo, faixa de valor)
- Etapas de comunicação (steps): canal (EMAIL, SMS, WHATSAPP), trigger (BEFORE_DUE, ON_DUE, AFTER_DUE), offsetDays, template da mensagem

**IMPORTANTE — Atualização do preview:**
A cada decisão do usuário, emita um bloco de atualização no formato:
<<CAMPAIGN_UPDATE>>
{"field": "value", ...}
<<END>>

O JSON deve conter APENAS os campos já definidos até o momento. Campos possíveis:
- name (string)
- description (string)
- startDate (string ISO)
- endDate (string ISO)
- maxCashDiscount (float, ex: 0.15)
- maxInstallments (int)
- monthlyInterestRate (float, ex: 0.02)
- minInstallmentCents (int, ex: 5000)
- targetFilters (object: { minDaysOverdue?: number, minValueCents?: number, maxValueCents?: number })
- steps (array: [{ trigger: "AFTER_DUE", offsetDays: 0, channel: "WHATSAPP", template: "texto..." }])
- status: sempre "DRAFT"

Emita o bloco CAMPAIGN_UPDATE sempre que um campo for definido ou alterado, mesmo que parcial.

**Confirmação final:**
Quando todos os campos estiverem definidos, apresente um resumo completo e pergunte: "Deseja criar esta campanha?"
Se o usuário confirmar, emita:
<<CAMPAIGN_CONFIRM>>

**Diretrizes:**
- Seja conciso e direto
- Sugira valores realistas baseados nos dados
- Use **negrito** para destaques
- Máximo 200 palavras por mensagem
- Não crie a campanha sem confirmação explícita`;

const CAMPAIGN_SUGGESTIONS_INSTRUCTION = `

Ao final da sua resposta, após uma linha em branco, adicione 2-3 sugestões curtas de próximo passo (máx 50 caracteres cada):
<<SUGESTÕES>>
Sugestão 1
Sugestão 2
Sugestão 3`;

// ── Build data context from real Prisma data ──

async function buildDataContext(tenantIds: string[]): Promise<string> {
  const fmtBRL = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  // Fetch customers with charges
  const customers = await prisma.customer.findMany({
    where: { franqueadoraId: { in: tenantIds } },
    include: { charges: true, franqueadora: { select: { id: true, nome: true } } },
  });

  // Fetch all charges
  const charges = await prisma.charge.findMany({
    where: { customer: { franqueadoraId: { in: tenantIds } } },
    include: { customer: { include: { franqueadora: { select: { id: true, nome: true } } } } },
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

  // If multiple tenants, organize by subsidiary
  if (tenantIds.length > 1) {
    const franqueadoraNames = new Map<string, string>();
    customers.forEach(c => {
      if (c.franqueadoraId && c.franqueadora?.nome) {
        franqueadoraNames.set(c.franqueadoraId, c.franqueadora.nome);
      }
    });

    let subsidiaryContexts = "";
    for (const [fId, fName] of Array.from(franqueadoraNames.entries())) {
      const fCustomerMetrics = customerMetrics.filter(cm => {
        const cust = customers.find(c => c.name === cm.nome);
        return cust?.franqueadoraId === fId;
      });
      const fCharges = charges.filter(c => c.customer?.franqueadoraId === fId);

      const fEmitido = fCustomerMetrics.reduce((s, c) => s + c.emitido, 0);
      const fRecebido = fCustomerMetrics.reduce((s, c) => s + c.recebido, 0);
      const fAberto = fCustomerMetrics.reduce((s, c) => s + c.aberto, 0);
      const fVencidasCount = fCharges.filter(c => c.status === "OVERDUE").length;
      const fValorVencido = fCharges.filter(c => c.status === "OVERDUE").reduce((s, c) => s + c.amountCents, 0);

      const fDetalhe = fCustomerMetrics
        .map(c => `  - ${c.nome} (${c.cidade}/${c.estado}): status=${c.status}, PMR=${c.pmr}d, inadimplência=${(c.inadimplencia * 100).toFixed(1)}%, aberto=${fmtBRL(c.aberto)}`)
        .join("\n");

      subsidiaryContexts += `
## SUBSIDIÁRIA: ${fName}
- Franqueados: ${fCustomerMetrics.length} | Emitido: ${fmtBRL(fEmitido)} | Recebido: ${fmtBRL(fRecebido)} | Aberto: ${fmtBRL(fAberto)}
- Cobranças vencidas: ${fVencidasCount} (${fmtBRL(fValorVencido)})

DETALHE:
${fDetalhe || "  Nenhum franqueado."}
`;
    }

    return `
=== DADOS DA REDE (VISÃO CONSOLIDADA) ===

TOTAIS GERAIS:
- Franqueados: ${customers.length} | Emitido: ${fmtBRL(totalEmitido)} | Recebido: ${fmtBRL(totalRecebido)} | Aberto: ${fmtBRL(totalAberto)}
- PMR médio: ${pmrMedio}d | Taxa de recebimento: ${taxaRecebimento.toFixed(1)}%
- Cobranças vencidas: ${vencidasCount} (${fmtBRL(valorVencido)})
${subsidiaryContexts}
===`;
  }

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

// ── Build campaign context ──

async function buildCampaignContext(tenantIds: string[]): Promise<string> {
  const fmtBRL = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const charges = await prisma.charge.findMany({
    where: {
      customer: { franqueadoraId: { in: tenantIds } },
      status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
    },
    include: { customer: { select: { id: true, name: true } } },
  });

  if (charges.length === 0) {
    return "\n=== DADOS PARA CAMPANHA ===\nNenhuma cobrança pendente encontrada.\n===";
  }

  const now = new Date();
  const daysDiff = (d: Date) => Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  // Group by overdue ranges
  const ranges = { ate30: 0, de30a60: 0, de60a90: 0, acima90: 0 };
  const rangesValue = { ate30: 0, de30a60: 0, de60a90: 0, acima90: 0 };
  let totalValue = 0;

  for (const c of charges) {
    const days = daysDiff(c.dueDate);
    totalValue += c.amountCents;
    if (days <= 30) { ranges.ate30++; rangesValue.ate30 += c.amountCents; }
    else if (days <= 60) { ranges.de30a60++; rangesValue.de30a60 += c.amountCents; }
    else if (days <= 90) { ranges.de60a90++; rangesValue.de60a90 += c.amountCents; }
    else { ranges.acima90++; rangesValue.acima90 += c.amountCents; }
  }

  // Unique customers
  const uniqueCustomers = new Set(charges.map((c) => c.customerId)).size;

  return `
=== DADOS PARA CAMPANHA ===
Total de cobranças pendentes: ${charges.length}
Clientes afetados: ${uniqueCustomers}
Valor total pendente: ${fmtBRL(totalValue)}

Distribuição por atraso:
- Até 30 dias: ${ranges.ate30} cobranças (${fmtBRL(rangesValue.ate30)})
- 30-60 dias: ${ranges.de30a60} cobranças (${fmtBRL(rangesValue.de30a60)})
- 60-90 dias: ${ranges.de60a90} cobranças (${fmtBRL(rangesValue.de60a90)})
- Acima de 90 dias: ${ranges.acima90} cobranças (${fmtBRL(rangesValue.acima90)})
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
  const requestedFranqueadoraId = request.headers.get("x-franqueadora-id") || null;
  const { session, tenantIds, error } = await requireTenantOrGroup(
    requestedFranqueadoraId === "all" ? null : requestedFranqueadoraId
  );
  if (error) return error;

  const userId = session!.user.id ?? "anonymous";

  // Rate limiting
  const { allowed, retryAfter } = checkRateLimit(userId);
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limit", retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const {
      messages: conversationMessages,
      message,
      stream: isStreaming = false,
      detailLevel = "resumido",
      pageContext,
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
    console.log("[Julia Debug] API key present:", !!process.env.ANTHROPIC_API_KEY, "client:", !!anthropic);
    const franqueadoraIdForCache = tenantIds.join(",");

    // Check preset cache for non-streaming or first message
    const isPreset = isPresetQuestion(lastUserMessage);
    const cacheKey = isPreset ? getCacheKey(lastUserMessage, franqueadoraIdForCache, detailLevel) : "";
    const cached = isPreset ? getCachedResponse(cacheKey) : null;

    // Structured logging
    console.log(JSON.stringify({
      userId,
      timestamp: new Date().toISOString(),
      cached: !!cached,
      model: "claude-haiku-4-5-20251001",
      isPreset,
    }));

    let systemPrompt: string;

    if (pageContext === "campaign-creation") {
      const campaignContext = anonymizeContext(await buildCampaignContext(tenantIds));
      systemPrompt = CAMPAIGN_SYSTEM_PROMPT + "\n" + campaignContext + "\n" + CAMPAIGN_SUGGESTIONS_INSTRUCTION;
    } else {
      const dataContext = anonymizeContext(await buildDataContext(tenantIds));
      const includeSuggestions = isStreaming;

      const detailInstruction = detailLevel === "detalhado"
        ? "\n\n**NÍVEL DE DETALHE: DETALHADO** — Seja completo e aprofundado. Até 500 palavras. Inclua análise detalhada, contexto histórico, comparações e recomendações estratégicas com justificativa."
        : "\n\n**NÍVEL DE DETALHE: RESUMIDO** — Seja extremamente conciso e direto. Máximo 150 palavras. Apenas os pontos essenciais e números-chave.";

      systemPrompt =
        JULIA_SYSTEM_PROMPT +
        detailInstruction +
        (tenantIds.length > 1 ? MULTI_SUBSIDIARY_INSTRUCTION : "") +
        "\n\n" +
        dataContext +
        (includeSuggestions ? SUGGESTIONS_INSTRUCTION + ACTIONS_INSTRUCTION : "");
    }

    // ── Streaming mode ──
    if (isStreaming) {
      // Serve cached response as stream if available
      if (cached) {
        const words = cached.split(" ");
        const readableStream = new ReadableStream({
          async start(controller) {
            for (let i = 0; i < words.length; i++) {
              const text = (i === 0 ? "" : " ") + words[i];
              controller.enqueue(sseEvent(JSON.stringify({ text })));
              await new Promise((r) => setTimeout(r, 15));
            }
            controller.enqueue(sseEvent("[DONE]"));
            controller.close();
          },
        });
        return new Response(readableStream, { headers: sseHeaders() });
      }

      if (anthropic) {
        try {
          let fullResponse = "";
          const readableStream = new ReadableStream({
            async start(controller) {
              const MAX_RETRIES = 3;
              let lastError: unknown = null;

              for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                  if (attempt > 0) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
                    console.log(`[Julia] Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`);
                    await new Promise((r) => setTimeout(r, delay));
                  }

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
                      fullResponse += event.delta.text;
                      controller.enqueue(
                        sseEvent(JSON.stringify({ text: event.delta.text }))
                      );
                    }
                  }

                  // Cache preset responses
                  if (isPreset && fullResponse) {
                    setCachedResponse(cacheKey, fullResponse);
                  }

                  lastError = null;
                  break; // Success — exit retry loop
                } catch (err) {
                  lastError = err;
                  const isOverloaded = err instanceof Error &&
                    (err.message.includes("overloaded") || err.message.includes("529"));
                  console.error(`[Julia] Stream error (attempt ${attempt + 1}):`, err);

                  // Only retry on overloaded errors
                  if (!isOverloaded) break;
                }
              }

              if (lastError) {
                const isOverloaded = lastError instanceof Error &&
                  (lastError.message.includes("overloaded") || lastError.message.includes("529"));
                const errorMsg = isOverloaded
                  ? "A Júlia está com alta demanda no momento. Por favor, tente novamente em alguns segundos. Se o problema persistir, verifique os créditos da API em console.anthropic.com."
                  : "Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.";
                controller.enqueue(
                  sseEvent(JSON.stringify({ text: errorMsg }))
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
      const fallbackText = "A Júlia está temporariamente indisponível. Tente novamente em alguns instantes.\n\n<<SUGESTÕES>>\nTentar novamente\nVer cobranças\nVer clientes";
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

    // Check cache for non-streaming presets
    if (cached) {
      return NextResponse.json({ reply: cached });
    }

    if (anthropic) {
      const MAX_RETRIES = 3;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
            console.log(`[Julia] Non-stream retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
          }

          const response = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: systemPrompt,
            messages: claudeMessages,
          });

          const textContent = response.content.find((c) => c.type === "text");
          const reply = textContent?.text ?? "";
          if (reply) {
            if (isPreset) {
              setCachedResponse(cacheKey, reply);
            }
            return NextResponse.json({ reply });
          }
          break; // Empty reply, don't retry
        } catch (err) {
          console.error(`[Julia] API error (attempt ${attempt + 1}):`, err);
          const isOverloaded = err instanceof Error &&
            (err.message.includes("overloaded") || err.message.includes("529"));
          if (!isOverloaded || attempt === MAX_RETRIES - 1) break;
        }
      }
    }

    // Fallback when no API key
    return NextResponse.json({
      reply: "A Júlia está temporariamente indisponível. Tente novamente em alguns instantes.",
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
