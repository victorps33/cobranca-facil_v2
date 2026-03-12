import { inngest } from "@/inngest";

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

    if (messageStatus === "delivered") {
      try {
        await inngest.send({
          name: "message/delivered",
          data: {
            providerMsgId: messageSid,
            status: "delivered",
          },
        });
      } catch (inngestErr) {
        console.error("[inngest] Failed to emit message/delivered:", inngestErr);
      }
    }

    if (messageStatus === "read") {
      try {
        await inngest.send({
          name: "engagement/status.received",
          data: {
            providerMsgId: messageSid,
            status: "read",
          },
        });
        // Also send delivered event for backwards compatibility
        await inngest.send({
          name: "message/delivered",
          data: {
            providerMsgId: messageSid,
            status: "delivered",
          },
        });
      } catch (inngestErr) {
        console.error("[inngest] Failed to emit engagement/status.received:", inngestErr);
      }
    }

    if (["failed", "undelivered"].includes(messageStatus)) {
      try {
        await inngest.send({
          name: "message/failed",
          data: {
            providerMsgId: messageSid,
            error: `Twilio status: ${messageStatus}`,
          },
        });
      } catch (inngestErr) {
        console.error("[inngest] Failed to emit message/failed:", inngestErr);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[Webhook Twilio Status] Error:", err);
    return new Response("OK", { status: 200 });
  }
}
