import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const captureEngagementFromDelivery = inngest.createFunction(
  {
    id: "capture-engagement-delivery",
    name: "Capture Engagement: Delivery Status",
  },
  { event: "message/delivered" },
  async ({ event, step }) => {
    await step.run("capture", async () => {
      const { providerMsgId } = event.data;

      const message = await prisma.message.findFirst({
        where: { externalId: providerMsgId },
        include: {
          conversation: {
            include: { customer: true },
          },
        },
      });

      if (!message || !message.conversation?.customer) return;

      const customer = message.conversation.customer;
      if (!customer.franqueadoraId) return;

      await prisma.engagementEvent.create({
        data: {
          customerId: customer.id,
          messageId: message.id,
          channel: message.channel || "WHATSAPP",
          eventType: "DELIVERED",
          occurredAt: new Date(),
          metadata: { providerMsgId },
          franqueadoraId: customer.franqueadoraId,
        },
      });
    });
  }
);

export const captureEngagementFromRead = inngest.createFunction(
  {
    id: "capture-engagement-read",
    name: "Capture Engagement: Read Status",
  },
  { event: "engagement/status.received" },
  async ({ event, step }) => {
    if (event.data.status !== "read") return;

    await step.run("capture", async () => {
      const { providerMsgId } = event.data;

      const message = await prisma.message.findFirst({
        where: { externalId: providerMsgId },
        include: {
          conversation: {
            include: { customer: true },
          },
        },
      });

      if (!message || !message.conversation?.customer) return;

      const customer = message.conversation.customer;
      if (!customer.franqueadoraId) return;

      await prisma.engagementEvent.create({
        data: {
          customerId: customer.id,
          messageId: message.id,
          channel: message.channel || "WHATSAPP",
          eventType: "READ",
          occurredAt: new Date(),
          metadata: { providerMsgId },
          franqueadoraId: customer.franqueadoraId,
        },
      });
    });
  }
);

export const captureEngagementFromReply = inngest.createFunction(
  {
    id: "capture-engagement-reply",
    name: "Capture Engagement: Inbound Reply",
  },
  { event: "inbound/received" },
  async ({ event, step }) => {
    await step.run("capture", async () => {
      const { customerId, franqueadoraId, channel } = event.data;
      if (!customerId || !franqueadoraId) return;

      await prisma.engagementEvent.create({
        data: {
          customerId,
          channel: channel || "WHATSAPP",
          eventType: "REPLIED",
          occurredAt: new Date(),
          franqueadoraId,
        },
      });
    });
  }
);

export const captureEngagementFromPayment = inngest.createFunction(
  {
    id: "capture-engagement-payment",
    name: "Capture Engagement: Payment",
  },
  { event: "charge/paid" },
  async ({ event, step }) => {
    await step.run("capture", async () => {
      const { chargeId } = event.data;

      const charge = await prisma.charge.findUnique({
        where: { id: chargeId },
        include: { customer: true },
      });

      if (!charge || !charge.customer.franqueadoraId) return;

      await prisma.engagementEvent.create({
        data: {
          customerId: charge.customerId,
          chargeId: charge.id,
          channel: "WHATSAPP",
          eventType: "PAID",
          occurredAt: new Date(),
          franqueadoraId: charge.customer.franqueadoraId,
        },
      });
    });
  }
);
