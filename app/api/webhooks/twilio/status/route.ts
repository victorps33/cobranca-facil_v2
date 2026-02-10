import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries()) as Record<
      string,
      string
    >;

    const messageSid = body.MessageSid || "";
    const messageStatus = body.MessageStatus || "";

    if (!messageSid) {
      return new Response("OK", { status: 200 });
    }

    // Map Twilio status to our status
    let newStatus: "DELIVERED" | "FAILED" | undefined;
    if (messageStatus === "delivered" || messageStatus === "read") {
      newStatus = "DELIVERED";
    } else if (
      messageStatus === "failed" ||
      messageStatus === "undelivered"
    ) {
      newStatus = "FAILED";
    }

    if (newStatus) {
      // Update MessageQueue by providerMsgId
      await prisma.messageQueue.updateMany({
        where: { providerMsgId: messageSid },
        data: { status: newStatus },
      });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[Webhook Twilio Status] Error:", err);
    return new Response("OK", { status: 200 });
  }
}
