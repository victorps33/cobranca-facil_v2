import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `Você é Mia, a agente de IA da Menlo para franqueadoras. Seu trabalho é transformar dados de cobrança em decisões claras.
Tom: curto, positivo, resolutivo. Linguagem simples. Sem jargão. Sem textos longos.
Estilo: padrão Stripe — minimalista, direto, confiável. Nunca invente dados; se faltar informação, diga o que faltou e peça um único dado adicional.
Sempre responda no formato:

**Resumo**
<1 frase>

**Insights**
- <bullet 1, objetivo, com número se houver no contexto>
- <bullet 2>
- <bullet 3>

**Próximas ações**
1. <ação 1 com verbo no imperativo e link interno sugerido quando aplicável>
2. <ação 2>
3. <ação 3>

Regras:
- Use os dados fornecidos no contexto como fonte de verdade.
- Se o usuário pedir algo fora do escopo do produto, redirecione com educação.
- Se detectar risco (inadimplência alta, concentração em poucos franqueados), sinalize com calma e sugira ação.
- Termine oferecendo 2 perguntas sugeridas, curtas, relacionadas ao que foi respondido.`;

// Mock responses for when LLM is not available
const mockResponses: Record<string, string> = {
  dividas: `**Resumo**
Você tem 3 clientes em situação de atenção imediata, totalizando R$ 47.500 em risco.

**Insights**
- Cliente "Franquia Recife" está há 120 dias em atraso com R$ 28.500 (maior risco)
- 2 clientes ultrapassaram 60 dias de atraso esta semana
- Taxa de recuperação caiu 8% no último mês

**Próximas ações**
1. Acesse /dividas e priorize o contato com Franquia Recife
2. Configure uma régua específica para inadimplentes em /reguas
3. Considere oferecer parcelamento para valores acima de R$ 10.000`,

  receita: `**Resumo**
Sua receita cresceu 12% nos últimos 30 dias, atingindo R$ 72.000.

**Insights**
- Pix representa 35% das transações (crescimento de 15% vs mês anterior)
- Boleto ainda domina com 52% do volume
- Ticket médio subiu de R$ 2.800 para R$ 3.100

**Próximas ações**
1. Incentive mais pagamentos via Pix para reduzir custos
2. Revise a estratégia de desconto para pagamentos antecipados
3. Acesse /emissao para ver a distribuição detalhada`,

  risco: `**Resumo**
5 clientes apresentam risco elevado de atraso baseado no histórico recente.

**Insights**
- Score médio de risco dos top 5: 78%
- Padrão comum: atrasos começam após 2ª cobrança
- Concentração: 3 dos 5 são do mesmo segmento

**Próximas ações**
1. Ative lembretes proativos 3 dias antes do vencimento
2. Configure a régua em /reguas para envio automático
3. Analise o perfil desses clientes em /clientes`,

  regua: `**Resumo**
Sua régua atual tem 4 passos, mas pode ser otimizada para pagadores duvidosos.

**Insights**
- Clientes que recebem WhatsApp no D-1 pagam 23% mais em dia
- E-mail no D+3 tem taxa de abertura de apenas 18%
- Ligação no D+15 recupera 45% dos casos

**Próximas ações**
1. Adicione um passo de WhatsApp em D-1 para todos
2. Substitua e-mail D+3 por SMS (maior taxa de leitura)
3. Acesse /reguas para implementar essas mudanças`,

  default: `**Resumo**
Sua operação está saudável. Veja os destaques do momento.

**Insights**
- R$ 163.000 em receita no último mês
- Taxa de recebimento em 78% (meta: 80%)
- 3 cobranças vencem esta semana

**Próximas ações**
1. Monitore as cobranças próximas do vencimento em /cobrancas
2. Revise clientes com potencial de atraso em /dividas
3. Emita novas cobranças pendentes em /emissao`,
};

function getMockResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("dívida") || lowerMessage.includes("atenção") || lowerMessage.includes("inadimpl")) {
    return mockResponses.dividas;
  }
  if (lowerMessage.includes("receita") || lowerMessage.includes("mudou") || lowerMessage.includes("faturamento")) {
    return mockResponses.receita;
  }
  if (lowerMessage.includes("risco") || lowerMessage.includes("atraso") || lowerMessage.includes("cliente")) {
    return mockResponses.risco;
  }
  if (lowerMessage.includes("régua") || lowerMessage.includes("regua") || lowerMessage.includes("ajuste") || lowerMessage.includes("pagadores")) {
    return mockResponses.regua;
  }
  
  return mockResponses.default;
}

async function getContextData() {
  try {
    // Get basic stats from database
    const [charges, customers] = await Promise.all([
      prisma.charge.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        include: { customer: true },
      }),
      prisma.customer.count(),
    ]);

    const totalRevenue = charges
      .filter((c) => c.status === "PAID")
      .reduce((acc, c) => acc + c.amountCents, 0);

    const overdueCharges = charges.filter((c) => c.status === "OVERDUE");
    const pendingCharges = charges.filter((c) => c.status === "PENDING");

    return {
      totalRevenue: totalRevenue / 100,
      totalCustomers: customers,
      overdueCount: overdueCharges.length,
      overdueTotal: overdueCharges.reduce((acc, c) => acc + c.amountCents, 0) / 100,
      pendingCount: pendingCharges.length,
      pendingTotal: pendingCharges.reduce((acc, c) => acc + c.amountCents, 0) / 100,
    };
  } catch (error) {
    console.error("Error fetching context:", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { message, timeframe, page } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get context data
    const context = await getContextData();

    // For now, use mock responses
    // In production, this would call an LLM API with the context and system prompt
    const replyMarkdown = getMockResponse(message);

    return NextResponse.json({
      replyMarkdown,
      suggestedQuestions: [
        "Como está a taxa de recebimento?",
        "Quais ações priorizar esta semana?",
      ],
      context: context, // Include context for debugging
    });
  } catch (error) {
    console.error("Error in Mia API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
