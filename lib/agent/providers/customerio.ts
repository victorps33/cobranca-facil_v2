import { createHmac } from "crypto";
import type { DispatchResult } from "../types";

const API_BASE = "https://api.customer.io/v1";
const TRANSACTIONAL_BASE = "https://api.customer.io/v1/send";

function getHeaders(): Record<string, string> {
  const key = process.env.CUSTOMERIO_API_KEY;
  if (!key) return {};
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

export async function sendTransactionalEmail(
  to: string,
  templateId: string,
  data: Record<string, string>
): Promise<DispatchResult> {
  const key = process.env.CUSTOMERIO_API_KEY;
  if (!key) {
    console.warn("[Customer.io] API key not configured — skipping email");
    return { success: true, providerMsgId: `mock-email-${Date.now()}` };
  }

  try {
    const res = await fetch(TRANSACTIONAL_BASE + "/email", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        transactional_message_id: templateId,
        to,
        identifiers: { email: to },
        message_data: data,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `Customer.io ${res.status}: ${body}` };
    }

    const json = await res.json();
    return { success: true, providerMsgId: json.delivery_id || json.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Customer.io] Email send error:", message);
    return { success: false, error: message };
  }
}

export async function sendRawEmail(
  to: string,
  subject: string,
  body: string
): Promise<DispatchResult> {
  const key = process.env.CUSTOMERIO_API_KEY;
  if (!key) {
    console.warn("[Customer.io] API key not configured — skipping raw email");
    return { success: true, providerMsgId: `mock-email-${Date.now()}` };
  }

  try {
    const res = await fetch(TRANSACTIONAL_BASE + "/email", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        to,
        identifiers: { email: to },
        subject,
        body,
        body_type: "html",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Customer.io ${res.status}: ${text}` };
    }

    const json = await res.json();
    return { success: true, providerMsgId: json.delivery_id || json.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Customer.io] Raw email send error:", message);
    return { success: false, error: message };
  }
}

export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const secret = process.env.CUSTOMERIO_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return expected === signature;
}
