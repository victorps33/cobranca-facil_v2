import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const JULIA_SYSTEM_PROMPT = `Você é Júlia, a Agente Menlo IA — analista de dados especializada em redes de franquias e gestão de cobranças.

**Persona:**
- Nome: Júlia
- Papel: Analista de dados da rede
- Tom: Profissional, amigável, resolutivo
- Estilo: Direto, com insights acionáveis

**Diretrizes de resposta:**
1. Seja concisa e objetiva
2. Use dados quando disponíveis
3. Sempre sugira ações concretas
4. Formate com bullet points e negrito para destaque
5. Termine com uma pergunta ou sugestão de próximo passo

**Formato padrão:**
**Resumo**
<1-2 frases resumindo a análise>

**Insights**
- <insight 1 com número/dado se disponível>
- <insight 2>
- <insight 3>

**Ações recomendadas**
1. <ação concreta>
2. <ação concreta>

**Próximo passo**
<sugestão ou pergunta para continuar>`;

// Mock responses baseadas no contexto
const contextResponses: Record<string, Record<string, string>> = {
  insights: {
    inadimplencia: `**Resumo**
A inadimplência está concentrada principalmente na região Nordeste (42%) e em franqueados com menos de 2 anos de operação.

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

    piorando: `**Resumo**
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

    efetividade: `**Resumo**
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

    risco: `**Resumo**
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
  },

  apuracao: {
    default: `**Resumo**
A apuração de Janeiro/2026 está pronta para emissão, com total de **R$ 163.000** entre royalties e FNP.

**Insights**
- 45 franqueados ativos para esta competência
- Royalties: R$ 125.000 (76% do total)
- FNP: R$ 38.000 (24% do total)
- 3 franqueados têm ajustes pendentes de aprovação

**Ações recomendadas**
1. Revise os ajustes pendentes antes de emitir
2. Verifique se há novos franqueados para incluir
3. Confirme a data de vencimento padrão (dia 15)

**Próximo passo**
Quer que eu liste os ajustes pendentes ou posso iniciar a emissão com os valores atuais?`,
  },

  emissao: {
    default: `**Resumo**
Você tem **8 franqueados** selecionados para emissão, totalizando R$ 31.860.

**Insights**
- 5 franqueados preferem boleto (62%)
- 3 franqueados preferem Pix (38%)
- 4 solicitaram emissão de NF junto
- Melhor dia para emissão: terça ou quarta (maior taxa de abertura)

**Ações recomendadas**
1. Confirme os dados de NF antes de emitir
2. Considere oferecer desconto de 2% para pagamento via Pix
3. Agende envio para terça-feira às 9h

**Próximo passo**
Posso verificar se há inconsistências nos dados ou prefere prosseguir com a emissão?`,
  },

  dividas: {
    default: `**Resumo**
Você tem **6 clientes inadimplentes** com total de R$ 79.000 em aberto e potencial de perda de R$ 55.894.

**Insights**
- **Franquia Recife** é o caso mais crítico (R$ 28.500, 120 dias)
- 2 clientes estão em processo de protesto
- Score de risco médio: 52%
- Último contato médio: há 12 dias

**Ações recomendadas**
1. Priorize contato com Franquia Recife hoje
2. Acione régua de recuperação para valores acima de R$ 10.000
3. Prepare proposta de parcelamento em até 6x

**Próximo passo**
Quer que eu prepare o script de negociação ou prefere ver o histórico de contatos?`,
  },

  reguas: {
    default: `**Resumo**
Sua régua ativa tem **4 passos** configurados, com taxa de conversão média de 72%.

**Insights**
- E-mail D-3 tem taxa de abertura de 45%
- WhatsApp D-1 converte 23% a mais que e-mail
- Ligação D+7 recupera 38% dos casos
- Melhor horário de envio: 9h-11h

**Ações recomendadas**
1. Adicione WhatsApp em D-1 para todos os perfis
2. Substitua SMS D+3 por WhatsApp (maior engajamento)
3. Crie régua específica para inadimplentes reincidentes

**Próximo passo**
Quer que eu sugira uma régua otimizada ou prefere ajustar a régua atual?`,
  },
};

function getMockResponse(message: string, pageContext: string): string {
  const lowerMessage = message.toLowerCase();
  const pageResponses = contextResponses[pageContext] || contextResponses.insights;

  // Check for specific keywords
  if (lowerMessage.includes("inadimpl") || lowerMessage.includes("concentra")) {
    return pageResponses.inadimplencia || pageResponses.default || getDefaultResponse(pageContext);
  }
  if (lowerMessage.includes("piora") || lowerMessage.includes("tendência") || lowerMessage.includes("franqueados")) {
    return pageResponses.piorando || pageResponses.default || getDefaultResponse(pageContext);
  }
  if (lowerMessage.includes("efetiv") || lowerMessage.includes("cobrança") || lowerMessage.includes("pmr")) {
    return pageResponses.efetividade || pageResponses.default || getDefaultResponse(pageContext);
  }
  if (lowerMessage.includes("risco") || lowerMessage.includes("exposição") || lowerMessage.includes("recuperação")) {
    return pageResponses.risco || pageResponses.default || getDefaultResponse(pageContext);
  }

  return pageResponses.default || getDefaultResponse(pageContext);
}

function getDefaultResponse(pageContext: string): string {
  return `**Resumo**
Estou analisando os dados da sua rede para trazer insights relevantes.

**Insights**
- Sua operação está dentro dos parâmetros esperados
- Não há alertas críticos no momento
- Recomendo revisar os indicadores semanalmente

**Ações recomendadas**
1. Continue monitorando os KPIs principais
2. Verifique a página de Dívidas para casos pendentes
3. Revise a configuração das réguas de cobrança

**Próximo passo**
Me conte mais sobre o que você gostaria de analisar — posso ajudar com inadimplência, performance, ou recomendações específicas.`;
}

async function getContextData() {
  try {
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
    const { message, pageContext = "insights" } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get context data from database
    const context = await getContextData();

    // Get mock response based on message and page context
    const reply = getMockResponse(message, pageContext);

    return NextResponse.json({
      reply,
      suggestions: [
        "Como melhorar a taxa de recebimento?",
        "Quais ações priorizar esta semana?",
      ],
      context,
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
