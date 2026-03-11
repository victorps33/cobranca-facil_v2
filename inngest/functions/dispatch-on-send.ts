import { inngest } from "../client";
import { dispatchMessage } from "@/lib/agent/dispatch";

export const dispatchOnSend = inngest.createFunction(
  {
    id: "dispatch-on-send",
    retries: 3,
    concurrency: [{ key: "event.data.messageId", limit: 1 }],
  },
  { event: "message/sent" },
  async ({ event }) => {
    const { messageId, channel, content, customerId, conversationId, franqueadoraId } = event.data;

    const result = await dispatchMessage({
      channel,
      content,
      customerId,
      conversationId,
      messageId,
      franqueadoraId,
    });

    if (!result.success) {
      throw new Error(`Dispatch failed: ${result.error}`);
    }

    return { dispatched: true, providerMsgId: result.providerMsgId };
  }
);
