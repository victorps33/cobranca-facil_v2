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

    if (["delivered", "read"].includes(messageStatus)) {
      await inngest.send({
        name: "message/delivered",
        data: {
          providerMsgId: messageSid,
        },
      });
    } else if (["failed", "undelivered"].includes(messageStatus)) {
      await inngest.send({
        name: "message/failed",
        data: {
          providerMsgId: messageSid,
          error: `Twilio status: ${messageStatus}`,
        },
      });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[Webhook Twilio Status] Error:", err);
    return new Response("OK", { status: 200 });
  }
}
