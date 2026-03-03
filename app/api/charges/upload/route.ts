import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup, requireRole } from "@/lib/auth-helpers";

function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith("sk-ant-your")) return null;
  return new Anthropic({ apiKey: key });
}

export async function POST(request: Request) {
  const roleCheck = await requireRole(["ADMINISTRADOR", "FINANCEIRO"]);
  if (roleCheck.error) return roleCheck.error;

  const requestedFranqueadoraId = request.headers.get("x-franqueadora-id") || null;
  const { tenantIds, error } = await requireTenantOrGroup(
    requestedFranqueadoraId === "all" ? null : requestedFranqueadoraId
  );
  if (error) return error;

  const targetFranqueadoraId = requestedFranqueadoraId && requestedFranqueadoraId !== "all"
    ? requestedFranqueadoraId
    : tenantIds.length === 1 ? tenantIds[0] : null;

  if (!targetFranqueadoraId) {
    return NextResponse.json(
      { error: "Selecione uma subsidiária específica para importar cobranças." },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isText = [".csv", ".txt", ".tsv"].includes(ext);
    const fileContent = isText
      ? buffer.toString("utf-8")
      : buffer.toString("utf-8").substring(0, 50000);

    const customers = await prisma.customer.findMany({
      where: { franqueadoraId: targetFranqueadoraId },
      select: { id: true, name: true, doc: true, email: true },
    });

    const customerList = customers
      .map((c) => `ID: ${c.id}, Nome: ${c.name}, Doc: ${c.doc}, Email: ${c.email}`)
      .join("\n");

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json({ error: "API de IA não configurada." }, { status: 503 });
    }

    const prompt = `Você é um assistente especializado em extrair dados de cobranças a partir de arquivos.

O usuário enviou "${file.name}". Extraia as cobranças e associe cada uma a um cliente existente.

Clientes existentes:
${customerList}

Conteúdo do arquivo:
---
${fileContent.substring(0, 40000)}
---

Retorne EXCLUSIVAMENTE um JSON válido:
{
  "charges": [
    {
      "customerName": "Nome exato do cliente (para matching)",
      "customerId": "ID do cliente se encontrado na lista acima, ou null",
      "description": "Descrição da cobrança",
      "amountCents": 10000,
      "dueDate": "YYYY-MM-DD",
      "status": "PENDING ou PAID ou OVERDUE",
      "paidAt": "YYYY-MM-DD ou null",
      "categoria": "categoria se disponível",
      "competencia": "MM/YYYY se disponível"
    }
  ],
  "warnings": ["avisos"],
  "summary": "resumo"
}

Regras:
- amountCents em centavos (R$ 100,00 = 10000). Se o valor parecer em reais, converta.
- dueDate obrigatório. Se não encontrado, use data atual.
- status: se paidAt existe → PAID, se dueDate < hoje → OVERDUE, senão PENDING
- Tente associar ao customerId da lista pelo nome mais similar
- Retorne APENAS o JSON`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === "text");
    const rawResponse = textContent?.text ?? "";

    let parsed: {
      charges: Record<string, unknown>[];
      warnings: string[];
      summary: string;
    };

    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "Não foi possível interpretar o arquivo." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      charges: parsed.charges ?? [],
      warnings: parsed.warnings ?? [],
      summary: parsed.summary ?? "",
      targetFranqueadoraId,
    });
  } catch (error) {
    console.error("Error in charges upload:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
