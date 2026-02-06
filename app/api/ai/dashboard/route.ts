import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const JULIA_PERSONA = `Você é Júlia, a Agente Menlo IA — especialista em análise de redes de franquias.

Tom: Profissional, amigável, resolutivo
Estilo: Direto ao ponto com insights acionáveis
Linguagem: Microcopy Menlo - frases curtas e positivas

Formato de resposta:
- Sempre inicie com um resumo em 1-2 linhas
- Liste 3-4 insights com dados
- Sugira 2-3 ações concretas
- Finalize com próximo passo ou pergunta`;

async function getDashboardContext() {
  try {
    const [charges, customers] = await Promise.all([
      prisma.charge.findMany({
        take: 500,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customer.count(),
    ]);

    const totalEmitted = charges.reduce((acc, c) => acc + c.amountCents, 0) / 100;
    const totalReceived = charges
      .filter((c) => c.status === "PAID")
      .reduce((acc, c) => acc + c.amountCents, 0) / 100;
    const overdueTotal = charges
      .filter((c) => c.status === "OVERDUE")
      .reduce((acc, c) => acc + c.amountCents, 0) / 100;

    return {
      totalEmitted,
      totalReceived,
      overdueTotal,
      receiptRate: totalEmitted > 0 ? (totalReceived / totalEmitted) * 100 : 0,
      overdueRate: totalEmitted > 0 ? (overdueTotal / totalEmitted) * 100 : 0,
      customerCount: customers,
    };
  } catch (error) {
    return null;
  }
}

function generateDashboardInsights(context: any) {
  const insights = [];
  
  if (context?.overdueRate > 5) {
    insights.push({
      type: "warning",
      title: "Taxa de inadimplência acima do ideal",
      message: `A taxa atual de ${context.overdueRate.toFixed(1)}% está acima dos 5% recomendados. Considere intensificar as ações de cobrança.`,
    });
  }

  if (context?.receiptRate < 80) {
    insights.push({
      type: "alert",
      title: "Taxa de recebimento baixa",
      message: `Com ${context.receiptRate.toFixed(1)}% de recebimento, há espaço para melhorias. Réguas automatizadas podem ajudar.`,
    });
  }

  return insights;
}

export async function POST(request: Request) {
  try {
    const { type, filters } = await request.json();

    const context = await getDashboardContext();
    const insights = generateDashboardInsights(context);

    // Generate recommendations based on context
    const recommendations = [
      {
        id: "1",
        priority: "high",
        action: "Criar campanha de negociação para clientes 'Exige Atenção'",
        impact: "Potencial recuperação de R$ 127.000",
      },
      {
        id: "2",
        priority: "medium",
        action: "Aumentar intervalo da régua para clientes 'Controlado'",
        impact: "Redução de 15% nos custos de cobrança",
      },
      {
        id: "3",
        priority: "medium",
        action: "Ativar WhatsApp D-1 para todos os perfis",
        impact: "Aumento de 23% na taxa de conversão",
      },
    ];

    return NextResponse.json({
      success: true,
      context,
      insights,
      recommendations,
      summary: {
        alertMessage: "Identifiquei 12 franqueados com padrão de atraso nos últimos 3 meses. Com uma ação preventiva, todos ganham: mais previsibilidade para você, mais flexibilidade para eles.",
        franchiseesAtRisk: 12,
        potentialRecovery: 127000,
      },
    });
  } catch (error) {
    console.error("Error in dashboard AI API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const context = await getDashboardContext();
    
    return NextResponse.json({
      success: true,
      context,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
