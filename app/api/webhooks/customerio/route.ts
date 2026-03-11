import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/agent/providers/customerio";
import { createInteractionLog } from "@/lib/inbox/sync";
import { inngest } from "@/inngest";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-cio-signature") || "";

    // Verify signature if secret is configured
    const secret = process.env.CUSTOMERIO_WEBHOOK_SECRET;
    if (secret && !verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type || payload.type || "";

    // Handle different event types
    switch (eventType) {
      case "email_replied": {
        const email = payload.data?.email_address || payload.email || "";
        const replyBody = payload.data?.body || payload.body || "";

        if (!email || !replyBody) break;

        // Find customer
        const customer = await prisma.customer.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        if (!customer || !customer.franqueadoraId) break;

        // Find or create conversation
        let conversation = await prisma.conversation.findFirst({
          where: {
            customerId: customer.id,
            channel: "EMAIL",
            status: { not: "RESOLVIDA" },
          },
          orderBy: { lastMessageAt: "desc" },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              customerId: customer.id,
              franqueadoraId: customer.franqueadoraId,
              channel: "EMAIL",
              status: "ABERTA",
              lastMessageAt: new Date(),
            },
          });
        }

        const delivery_id = payload.data?.delivery_id || payload.delivery_id;

        // Idempotency: check if this delivery was already processed
        const existingMsg = await prisma.message.findFirst({
          where: { externalId: delivery_id },
        });

        if (existingMsg) {
          return NextResponse.json({ status: "duplicate" });
        }

        // Create message
        const message = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            sender: "CUSTOMER",
            content: replyBody,
            contentType: "text",
            channel: "EMAIL",
            externalId: delivery_id,
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date(), status: "PENDENTE_IA" },
        });

        // Sync to InteractionLog
        await createInteractionLog({
          customerId: customer.id,
          channel: "EMAIL",
          content: replyBody,
          direction: "INBOUND",
          franqueadoraId: customer.franqueadoraId,
        });

        // Emit inbound event for async AI processing
        await inngest.send({
          name: "inbound/received",
          data: {
            from: email,
            body: replyBody,
            channel: "EMAIL" as const,
            providerMsgId: delivery_id || "",
            customerId: customer.id,
            conversationId: conversation.id,
            messageId: message.id,
            franqueadoraId: customer.franqueadoraId,
          },
        });
        break;
      }

      case "email_bounced": {
        const bouncedDeliveryId = payload.data?.delivery_id || payload.delivery_id;
        if (bouncedDeliveryId) {
          await inngest.send({
            name: "message/failed",
            data: { providerMsgId: bouncedDeliveryId, error: "Email bounced" },
          });
        }
        break;
      }

      case "email_delivered": {
        const deliveredDeliveryId = payload.data?.delivery_id || payload.delivery_id;
        if (deliveredDeliveryId) {
          await inngest.send({
            name: "message/delivered",
            data: { providerMsgId: deliveredDeliveryId },
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Webhook Customer.io] Error:", err);
    return NextResponse.json({ received: true });
  }
}
