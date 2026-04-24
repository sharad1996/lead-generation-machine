import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/server/outreach/email";
import { sendWhatsApp } from "@/server/outreach/whatsapp";
import { queueLinkedInOutreach } from "@/server/outreach/linkedin";
import { renderTemplate } from "@/server/outreach/templates";

export type OutreachRequest = {
  campaignId?: string;
  /** When no campaignId, create ephemeral campaign from these fields */
  name?: string;
  messageTemplate?: string;
  channel?: "email" | "whatsapp" | "linkedin";
  leadIds: string[];
};

function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export async function runOutreach(req: OutreachRequest): Promise<{ logs: number }> {
  let campaign = req.campaignId
    ? await prisma.campaign.findUnique({ where: { id: req.campaignId } })
    : null;

  if (!campaign && req.name && req.messageTemplate && req.channel) {
    campaign = await prisma.campaign.create({
      data: {
        name: req.name,
        messageTemplate: req.messageTemplate,
        channel: req.channel,
      },
    });
  }

  if (!campaign) {
    throw new Error("Provide campaignId or name, messageTemplate, and channel");
  }

  const leads = await prisma.lead.findMany({ where: { id: { in: req.leadIds } } });
  let count = 0;

  for (const lead of leads) {
    const body = renderTemplate(campaign.messageTemplate, {
      businessName: lead.name,
      location: lead.location ?? "",
    });

    let status = "sent";
    let response: string | null = null;

    try {
      if (campaign.channel === "email") {
        if (!lead.email) {
          status = "skipped_no_email";
        } else {
          const r = await sendEmail({
            to: lead.email,
            subject: `Quick idea for ${lead.name}`,
            text: body,
          });
          response = r.messageId;
        }
      } else if (campaign.channel === "whatsapp") {
        if (!lead.phone) {
          status = "skipped_no_phone";
        } else {
          const r = await sendWhatsApp({
            toE164: normalizePhoneE164(lead.phone),
            body,
          });
          response = JSON.stringify(r);
        }
      } else if (campaign.channel === "linkedin") {
        const r = await queueLinkedInOutreach({ leadName: lead.name, message: body });
        response = JSON.stringify(r);
      } else {
        status = "unknown_channel";
      }
    } catch (e) {
      status = "error";
      response = String(e);
      logger.error("Outreach send failed", { leadId: lead.id, error: response });
    }

    await prisma.outreachLog.create({
      data: {
        leadId: lead.id,
        campaignId: campaign.id,
        status,
        response,
      },
    });

    if (status === "sent") {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "contacted" },
      });
    }
    count++;
  }

  return { logs: count };
}
