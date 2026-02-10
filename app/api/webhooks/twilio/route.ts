import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/agent/providers/twilio";
import { createInteractionLog } from "@/lib/inbox/sync";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries()) as Record<
      string,
      string
    >;

    // Extract message details
    const from = body.From || "";
    const messageBody = body.Body || "";
    const messageSid = body.MessageSid || "";
    const isWhatsApp = from.startsWith("whatsapp:");

    const channel = isWhatsApp ? "WHATSAPP" : "SMS";
    const normalizedPhone = normalizePhone(from);

    // Find customer by phone
    const customer = await prisma.customer.findFirst({
      where: {
        phone: {
          contains: normalizedPhone.replace("+55", ""),
        },
      },
    });

    if (!customer || !customer.franqueadoraId) {
      // Still return 200 so Twilio doesn't retry
      console.warn(`[Webhook Twilio] Customer not found for phone: ${normalizedPhone}`);
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

    // Return TwiML empty response
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
