import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/auth-helpers";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const { error } = await requireTenant();
  if (error) return error;

  const roleCheck = await requireRole(["ADMINISTRADOR", "OPERACIONAL"]);
  if (roleCheck.error) return roleCheck.error;

  const { stepId, count = 3, context } = await req.json();

  const step = await prisma.dunningStep.findUnique({
    where: { id: stepId },
    include: { rule: true, variants: true },
  });

  if (!step)
    return NextResponse.json({ error: "Step not found" }, { status: 404 });

  const existingTemplates = step.variants
    .map((v) => v.template)
    .join("\n---\n");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Você é uma especialista em cobrança chamada Mia. Gere ${count} variantes de mensagem de cobrança para o seguinte contexto:

- Fase: ${step.phase}
- Canal: ${step.channel}
- Dia relativo ao vencimento: D${step.offsetDays >= 0 ? "+" : ""}${step.offsetDays}
- Perfil de risco: ${step.rule.riskProfile}
${context ? `- Contexto adicional: ${context}` : ""}

Variáveis disponíveis: {{nome}}, {{valor}}, {{vencimento}}, {{link_boleto}}, {{descricao}}

${existingTemplates ? `Variantes já existentes (gere versões DIFERENTES):\n${existingTemplates}` : ""}

Retorne APENAS as mensagens, uma por linha, separadas por ---. Sem numeração, sem explicação.
${step.channel === "SMS" ? "Máximo 160 caracteres cada." : step.channel === "WHATSAPP" ? "Máximo 300 caracteres cada." : "Máximo 500 palavras cada."}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const templates = text
    .split("---")
    .map((t) => t.trim())
    .filter(Boolean);

  const existingLabels = step.variants.map((v) => v.label);
  const nextLabels = "ABCDEFGH"
    .split("")
    .filter((l) => !existingLabels.includes(l));

  const created = [];
  for (let i = 0; i < Math.min(templates.length, nextLabels.length); i++) {
    const variant = await prisma.stepVariant.create({
      data: {
        stepId,
        label: nextLabels[i],
        template: templates[i],
        generatedByAi: true,
      },
    });
    created.push(variant);
  }

  return NextResponse.json(created, { status: 201 });
}
