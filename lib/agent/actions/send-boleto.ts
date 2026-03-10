import { prisma } from "@/lib/prisma";
import type { InboundContext, AIDecision } from "../types";

export interface SendBoletoResult {
  message: string;
  createHumanTask: boolean;
}

export async function executeSendBoleto(
  ctx: InboundContext,
  decision: AIDecision
): Promise<SendBoletoResult> {
  const targetChargeId = decision.metadata?.chargeId;

  const boleto = targetChargeId
    ? ctx.boletos.find((b) => b.chargeId === targetChargeId)
    : ctx.boletos[0];

  if (!boleto) {
    return {
      message:
        "Estou verificando o seu boleto. Em instantes, um especialista da nossa equipe vai enviar para voce.",
      createHumanTask: true,
    };
  }

  const message =
    ctx.channel === "WHATSAPP" || ctx.channel === "SMS"
      ? `Aqui esta o link do seu boleto: ${boleto.publicUrl}`
      : `Segue o link para pagamento do seu boleto:\n\n${boleto.publicUrl}\n\nLinha digitavel: ${boleto.linhaDigitavel}`;

  return {
    message,
    createHumanTask: false,
  };
}
