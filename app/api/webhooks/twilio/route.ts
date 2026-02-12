import { prisma } from "@/lib/prisma";
import { normalizePhone, verifyTwilioSignature } from "@/lib/agent/providers/twilio";
import { createInteractionLog } from "@/lib/inbox/sync";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries()) as Record<
      string,
      string
    >;

    // Verify Twilio signature
    const signature = request.headers.get("x-twilio-signature") || "";
    // Use WEBHOOK_BASE_URL (public URL) for signature verification, fallback to NEXTAUTH_URL or request.url
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.NEXTAUTH_URL;
    const url = webhookBaseUrl
      ? `${webhookBaseUrl}/api/webhooks/twilio`
      : request.url;

    if (process.env.TWILIO_AUTH_TOKEN && !verifyTwilioSignature(url, body, signature)) {
      console.warn("[Webhook Twilio] Invalid signature");
      return new Response("Forbidden", { status: 403 });
    }

    // Extract message details
    console.log("[Webhook Twilio] Body keys:", Object.keys(body).join(", "));
    console.log("[Webhook Twilio] From:", body.From, "To:", body.To, "WaId:", body.WaId);
    const from = body.From || (body.WaId ? `whatsapp:+${body.WaId}` : "");
    const to = body.To || "";
    const messageBody = body.Body || "";
    const messageSid = body.MessageSid || "";
    const isWhatsApp = from.startsWith("whatsapp:");

    const channel = isWhatsApp ? "WHATSAPP" : "SMS";
    const normalizedPhone = normalizePhone(from);
    // Número exato que o WhatsApp/Twilio usa (ex: +554899026030)
    const rawWhatsappPhone = from.replace(/^whatsapp:/, "");

    // Resolve franqueadora by the destination number (To field)
    let resolvedFranqueadoraId: string | null = null;
    if (to) {
      const normalizedTo = to.startsWith("whatsapp:")
        ? to  // WhatsApp: keep as-is (whatsapp:+55...)
        : normalizePhone(to);  // SMS: normalize to +55...

      const configByTo = await prisma.agentConfig.findFirst({
        where: {
          OR: [
            { whatsappFrom: normalizedTo },
            { smsFrom: normalizedTo },
            // Also try the raw To value in case format differs slightly
            { whatsappFrom: to },
            { smsFrom: to },
          ],
        },
        select: { franqueadoraId: true },
      });

      if (configByTo) {
        resolvedFranqueadoraId = configByTo.franqueadoraId;
        console.log(`[Webhook Twilio] Resolved franqueadora ${resolvedFranqueadoraId} from To: ${to}`);
      }
    }

    // Find customer by phone — tenta com e sem nono dígito
    const phoneDigits = normalizedPhone.replace("+55", "");
    // Gera variante sem nono dígito (ex: 48999026030 → 4899026030)
    const withoutNinthDigit =
      phoneDigits.length === 11 && /^\d{2}9/.test(phoneDigits)
        ? phoneDigits.slice(0, 2) + phoneDigits.slice(3)
        : null;

    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { whatsappPhone: rawWhatsappPhone },
          { phone: { contains: phoneDigits } },
          ...(withoutNinthDigit
            ? [{ phone: { contains: withoutNinthDigit } }]
            : []),
        ],
        // If we know the franqueadora, scope the search to it
        ...(resolvedFranqueadoraId ? { franqueadoraId: resolvedFranqueadoraId } : {}),
      },
    });

    // If not found scoped to the resolved franqueadora, try global lookup
    if (!customer && resolvedFranqueadoraId) {
      customer = await prisma.customer.findFirst({
        where: {
          OR: [
            { whatsappPhone: rawWhatsappPhone },
            { phone: { contains: phoneDigits } },
            ...(withoutNinthDigit
              ? [{ phone: { contains: withoutNinthDigit } }]
              : []),
          ],
        },
      });
    }

    // Se encontrou, atualiza o whatsappPhone para garantir envio correto
    if (customer && isWhatsApp && customer.whatsappPhone !== rawWhatsappPhone) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { whatsappPhone: rawWhatsappPhone },
      });
      customer.whatsappPhone = rawWhatsappPhone;
    }

    // Auto-create customer if not found
    if (!customer) {
      // Use resolved franqueadora or fall back to first available
      let franqueadoraId = resolvedFranqueadoraId;
      if (!franqueadoraId) {
        const defaultFranqueadora = await prisma.franqueadora.findFirst();
        if (!defaultFranqueadora) {
          console.warn("[Webhook Twilio] No franqueadora found — cannot create customer");
          return new Response(
            '<Response></Response>',
            { status: 200, headers: { "Content-Type": "text/xml" } }
          );
        }
        franqueadoraId = defaultFranqueadora.id;
      }

      const profileName = body.ProfileName || normalizedPhone;
      customer = await prisma.customer.create({
        data: {
          name: profileName,
          doc: "",
          email: "",
          phone: normalizedPhone,
          whatsappPhone: isWhatsApp ? rawWhatsappPhone : null,
          franqueadoraId,
        },
      });
      console.log(`[Webhook Twilio] Auto-created customer: ${customer.id} (${profileName}) for franqueadora ${franqueadoraId}`);
    }

    if (!customer.franqueadoraId) {
      console.warn(`[Webhook Twilio] Customer ${customer.id} has no franqueadoraId`);
      return new Response(
        '<Response></Response>',
        { status: 200, headers: { "Content-Type": "text/xml" } }
      );
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        customerId: customer.id,
        channel,
        status: { not: "RESOLVIDA" },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          customerId: customer.id,
          franqueadoraId: customer.franqueadoraId,
          channel,
          status: "ABERTA",
          lastMessageAt: new Date(),
        },
      });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: "CUSTOMER",
        content: messageBody,
        contentType: "text",
        channel,
        externalId: messageSid,
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        status: "PENDENTE_IA",
      },
    });

    // Create InteractionLog
    await createInteractionLog({
      customerId: customer.id,
      channel,
      content: messageBody,
      direction: "INBOUND",
      franqueadoraId: customer.franqueadoraId,
    });

    // Fire-and-forget AI processing
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL;
    if (baseUrl) {
      const processUrl = `${baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`}/api/agent/process-inbound`;
      fetch(processUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          messageId: message.id,
        }),
      }).catch((err) =>
        console.error("[Webhook Twilio] Fire-and-forget failed:", err)
      );
    }

    return new Response(
      '<Response></Response>',
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  } catch (err) {
    console.error("[Webhook Twilio] Error:", err);
    return new Response(
      '<Response></Response>',
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }
}
