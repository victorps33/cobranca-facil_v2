import twilio from "twilio";
import type { DispatchResult } from "../types";

let _client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio | null {
  if (_client) return _client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  _client = twilio(sid, token);
  return _client;
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/^whatsapp:/, "").replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = "55" + cleaned;
  }
  return "+" + cleaned;
}

export async function sendWhatsApp(
  to: string,
  body: string
): Promise<DispatchResult> {
  const client = getClient();
  if (!client) {
    console.warn("[Twilio] Client not configured — skipping WhatsApp send");
    return { success: true, providerMsgId: `mock-wa-${Date.now()}` };
  }

  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) {
    return { success: false, error: "TWILIO_WHATSAPP_FROM not configured" };
  }

  try {
    const normalized = normalizePhone(to);
    const fromAddr = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
    const msg = await client.messages.create({
      from: fromAddr,
      to: `whatsapp:${normalized}`,
      body,
    });
    return { success: true, providerMsgId: msg.sid };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Twilio] WhatsApp send error:", message);
    return { success: false, error: message };
  }
}

export async function sendSms(
  to: string,
  body: string
): Promise<DispatchResult> {
  const client = getClient();
  if (!client) {
    console.warn("[Twilio] Client not configured — skipping SMS send");
    return { success: true, providerMsgId: `mock-sms-${Date.now()}` };
  }

  const from = process.env.TWILIO_SMS_FROM;
  if (!from) {
    return { success: false, error: "TWILIO_SMS_FROM not configured" };
  }

  try {
    const normalized = normalizePhone(to);
    const msg = await client.messages.create({ from, to: normalized, body });
    return { success: true, providerMsgId: msg.sid };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Twilio] SMS send error:", message);
    return { success: false, error: message };
  }
}

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  return twilio.validateRequest(token, signature, url, params);
}
