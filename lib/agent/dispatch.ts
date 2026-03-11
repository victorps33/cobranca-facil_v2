import { prisma } from "@/lib/prisma";
import { sendWhatsApp, sendSms } from "./providers/twilio";
import { sendRawEmail } from "./providers/customerio";
import type { Channel } from "@prisma/client";
import type { DispatchResult, WorkingHours } from "./types";

// ---------------------------------------------------------------------------
// DispatchRequest – a plain object used by Inngest sagas and other callers to
// dispatch messages via the appropriate provider.
// ---------------------------------------------------------------------------
export interface DispatchRequest {
  channel: Channel;
  content: string;
  customerId: string;
  conversationId?: string;
  messageId?: string;
  franqueadoraId: string;
}

export function isWithinWorkingHours(config: WorkingHours): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    hour: "numeric",
    hour12: false,
  });
  const currentHour = parseInt(formatter.format(now), 10);
  return currentHour >= config.start && currentHour < config.end;
}

// ---------------------------------------------------------------------------
// dispatchMessage – sends a message via the appropriate provider (WhatsApp,
// SMS, or Email) and optionally updates the Message record with the provider ID.
// ---------------------------------------------------------------------------
export async function dispatchMessage(request: DispatchRequest): Promise<DispatchResult> {
  const { channel, content, customerId, franqueadoraId } = request;

  try {
    // Fetch customer and agent config (for provider from-numbers) in parallel
    const [customer, agentConfig] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.agentConfig.findFirst({
        where: { franqueadoraId, enabled: true },
        select: { whatsappFrom: true, smsFrom: true },
      }),
    ]);

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    let result: DispatchResult;

    switch (channel) {
      case "WHATSAPP":
        result = await sendWhatsApp(
          customer.whatsappPhone || customer.phone,
          content,
          agentConfig?.whatsappFrom ?? undefined
        );
        break;
      case "SMS":
        result = await sendSms(
          customer.phone,
          content,
          agentConfig?.smsFrom ?? undefined
        );
        break;
      case "EMAIL":
        result = await sendRawEmail(customer.email, "Notificação de cobrança", content);
        break;
      default:
        return { success: false, error: `Unsupported channel: ${channel}` };
    }

    // Update message record if provided
    if (request.messageId && result.success && result.providerMsgId) {
      await prisma.message.update({
        where: { id: request.messageId },
        data: { externalId: result.providerMsgId },
      });
    }

    return result;
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

