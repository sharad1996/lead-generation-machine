import { logger } from "@/lib/logger";

export type WhatsAppSendParams = {
  toE164: string;
  body: string;
};

/**
 * WhatsApp: logs by default. Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM to use Twilio.
 */
export async function sendWhatsApp(params: WhatsAppSendParams): Promise<{ mode: "twilio" | "log"; sid?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (sid && token && from) {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      From: from,
      To: `whatsapp:${params.toE164}`,
      Body: params.body,
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Twilio WhatsApp failed: ${res.status} ${t}`);
    }
    const json = (await res.json()) as { sid: string };
    logger.info("WhatsApp sent via Twilio", { to: params.toE164, sid: json.sid });
    return { mode: "twilio", sid: json.sid };
  }

  logger.info("[WhatsApp simulation]", { to: params.toE164, body: params.body });
  return { mode: "log" };
}
