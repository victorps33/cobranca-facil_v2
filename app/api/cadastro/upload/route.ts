import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado." },
        { status: 400 }
      );
    }

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // For binary files (xlsx, xls), convert to base64 and describe as attachment
    // For text files (csv, txt), read as text
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isText = [".csv", ".txt", ".tsv"].includes(ext);

    let fileContent: string;
    if (isText) {
      fileContent = buffer.toString("utf-8");
    } else {
      // For binary files, try to decode as utf-8 and if it's garbage, use base64 summary
      const decoded = buffer.toString("utf-8");
      const printableRatio =
        decoded.split("").filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127).length /
        decoded.length;

      if (printableRatio > 0.5) {
        fileContent = decoded.substring(0, 50000);
      } else {
        // For binary files like xlsx, we need to extract text differently
        // Send as base64 document
        fileContent = `[Arquivo binário: ${file.name}, ${file.size} bytes. Não é possível ler diretamente o conteúdo.]`;
      }
    }

    const prompt = `Você é um assistente especializado em extrair dados estruturados de franqueados/lojas a partir de arquivos.

O usuário enviou um arquivo chamado "${file.name}". Analise o conteúdo abaixo e extraia os dados de franqueados/lojas.

Conteúdo do arquivo:
---
${fileContent.substring(0, 40000)}
---

Extraia os dados e retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem blocos de código, sem texto adicional) no seguinte formato:

{
  "franqueados": [
    {
      "nome": "Nome da franquia/loja",
      "razaoSocial": "Razão social se disponível",
      "cnpj": "CNPJ se disponível",
      "email": "Email se disponível",
      "telefone": "Telefone se disponível",
      "cidade": "Cidade se disponível",
      "estado": "UF (2 letras) se disponível",
      "bairro": "Bairro se disponível",
      "dataAbertura": "YYYY-MM-DD se disponível",
      "responsavel": "Nome do responsável se disponível",
      "statusLoja": "Aberta ou Fechada ou Vendida"
    }
  ],
  "warnings": ["Lista de avisos sobre dados que não puderam ser extraídos ou estão incompletos"],
  "summary": "Resumo breve do que foi encontrado no arquivo"
}

Regras:
- Use "" (string vazia) para campos não encontrados no arquivo
- statusLoja deve ser "Aberta", "Fechada" ou "Vendida". Se não especificado, use "Aberta"
- Se o arquivo não contém dados de franqueados/lojas, retorne franqueados vazio e explique em warnings
- O campo "nome" é obrigatório. Pule registros sem nome
- Retorne APENAS o JSON, sem nenhum texto antes ou depois`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === "text");
    const rawResponse = textContent?.text ?? "";

    // Parse the JSON response
    let parsed: {
      franqueados: Record<string, string>[];
      warnings: string[];
      summary: string;
    };

    try {
      // Try to extract JSON from the response (handle potential markdown wrapping)
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        {
          error:
            "Não foi possível interpretar o arquivo. Tente com um formato diferente.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      franqueados: parsed.franqueados ?? [],
      warnings: parsed.warnings ?? [],
      summary: parsed.summary ?? "",
    });
  } catch (error) {
    console.error("Error in cadastro upload API:", error);
    const message =
      error instanceof Error ? error.message : "Erro interno do servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
