import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "1";

  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASS must be set to send email");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendEmail(params: SendEmailParams): Promise<{ messageId: string }> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("SMTP_FROM or SMTP_USER required");

  const transport = createTransport();
  const info = await transport.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
  logger.info("Email sent", { to: params.to, messageId: info.messageId });
  return { messageId: String(info.messageId) };
}
