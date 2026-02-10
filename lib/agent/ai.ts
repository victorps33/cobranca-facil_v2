import Anthropic from "@anthropic-ai/sdk";
import { MIA_SYSTEM_PROMPT } from "./prompts";
import {
  renderDunningPrompt,
  renderInboundPrompt,
} from "./context-builder";
import type { AIDecision, CollectionContext, InboundContext } from "./types";

function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith("sk-ant-your")) return null;
  return new Anthropic({ apiKey: key });
}

const MODEL = process.env.AGENT_AI_MODEL || "claude-haiku-4-5-20251001";

function parseAIResponse(text: string): AIDecision {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      action: "SKIP",
      message: "",
      confidence: 0,
      reasoning: "Falha ao parsear resposta da IA",
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      action: parsed.action || "SKIP",
      message: parsed.message || "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      reasoning: parsed.reasoning || "",
      escalationReason: parsed.escalationReason || undefined,
    };
  } catch {
    return {
      action: "SKIP",
      message: "",
      confidence: 0,
      reasoning: "Erro de parse JSON na resposta da IA",
    };
  }
}

function fallbackDunningDecision(ctx: CollectionContext): AIDecision {
  const { customer, charge, channel } = ctx;
  const valor =
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(charge.amountCents / 100);

  let message: string;
  if (channel === "SMS") {
    message = `${customer.name}, cobrança ${charge.description} (${valor}) vencida. Entre em contato.`;
  } else if (channel === "WHATSAPP") {
    message = `Olá ${customer.name}! A cobrança "${charge.description}" no valor de ${valor} está pendente. Podemos ajudar?`;
  } else {
    message = `Prezado(a) ${customer.name},\n\nInformamos que a cobrança "${charge.description}" no valor de ${valor} encontra-se pendente.\n\nCaso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.\n\nAtenciosamente,\nEquipe de Cobrança`;
  }

  return {
    action: "SEND_COLLECTION",
    message,
    confidence: 0.7,
    reasoning: "Fallback: template padrão (IA indisponível)",
  };
}

export async function decideCollectionAction(
  ctx: CollectionContext,
  systemPromptOverride?: string | null
): Promise<AIDecision> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return fallbackDunningDecision(ctx);
  }

  const userPrompt = renderDunningPrompt(ctx);
  const systemPrompt = systemPromptOverride || MIA_SYSTEM_PROMPT;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return fallbackDunningDecision(ctx);
    }

    return parseAIResponse(textContent.text);
  } catch (err) {
    console.error("[Agent AI] Collection decision error:", err);
    return fallbackDunningDecision(ctx);
  }
}

export async function decideInboundResponse(
  ctx: InboundContext,
  systemPromptOverride?: string | null
): Promise<AIDecision> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return {
      action: "ESCALATE_HUMAN",
      message: "",
      confidence: 0,
      reasoning: "IA indisponível — escalando para humano",
      escalationReason: "AI_UNCERTAINTY",
    };
  }

  const userPrompt = renderInboundPrompt(ctx);
  const systemPrompt = systemPromptOverride || MIA_SYSTEM_PROMPT;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return {
        action: "ESCALATE_HUMAN",
        message: "",
        confidence: 0,
        reasoning: "Resposta vazia da IA",
        escalationReason: "AI_UNCERTAINTY",
      };
    }

    return parseAIResponse(textContent.text);
  } catch (err) {
    console.error("[Agent AI] Inbound response error:", err);
    return {
      action: "ESCALATE_HUMAN",
      message: "",
      confidence: 0,
      reasoning: "Erro na chamada de IA — escalando",
      escalationReason: "AI_UNCERTAINTY",
    };
  }
}
