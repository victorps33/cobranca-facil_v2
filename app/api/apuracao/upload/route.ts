import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireTenant, requireRole } from "@/lib/auth-helpers";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface UploadRequestBody {
  rows: {
    nome: string;
    pdv: number;
    ifood: number;
    rappi: number;
    total: number;
    mesAnterior: number;
  }[];
  headers: string[];
}

function formatCentsAsBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export async function POST(request: Request) {
  const { error } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO"]);
  if (roleCheck.error) return roleCheck.error;

  try {
    const body = (await request.json()) as UploadRequestBody;

    if (!body.rows || body.rows.length === 0) {
      return NextResponse.json(
        { error: "Nenhum dado encontrado na planilha." },
        { status: 400 }
      );
    }

    // Build a formatted table for Claude
    const tableHeader =
      "| Franqueado | PDV | iFood | Rappi | Total | Mês Anterior |";
    const tableSep =
      "|------------|-----|-------|-------|-------|--------------|";
    const tableRows = body.rows.map(
      (r) =>
        `| ${r.nome} | ${formatCentsAsBRL(r.pdv)} | ${formatCentsAsBRL(r.ifood)} | ${formatCentsAsBRL(r.rappi)} | ${formatCentsAsBRL(r.total)} | ${formatCentsAsBRL(r.mesAnterior)} |`
    );

    const tableContent = [tableHeader, tableSep, ...tableRows].join("\n");

    const prompt = `Você é uma assistente de análise financeira para uma rede de franquias. Analise os dados de faturamento abaixo e forneça um sumário conciso em português do Brasil.

Dados da planilha importada:

${tableContent}

Forneça um sumário com:
1. Quantidade total de franqueados na planilha
2. Faturamento total da rede (soma da coluna Total)
3. Franqueado com maior e menor faturamento
4. Se houver coluna "Mês Anterior" com valores, indique variações significativas (>20%) — positivas ou negativas
5. Alertas ou observações relevantes (ex: franqueados sem faturamento, valores zerados, etc.)

Formato: texto corrido, organizado em parágrafos curtos. Seja direto e objetivo. Use valores em R$ formatados.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === "text");
    const summary = textContent?.text ?? "Não foi possível gerar o sumário.";

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Error in apuração upload API:", error);

    const message =
      error instanceof Error ? error.message : "Erro interno do servidor";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
