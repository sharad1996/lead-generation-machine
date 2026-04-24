import { NextResponse } from "next/server";
import { runOutreach } from "@/server/jobs/outreach-service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      campaignId?: string;
      name?: string;
      messageTemplate?: string;
      channel?: "email" | "whatsapp" | "linkedin";
      leadIds: string[];
    };

    if (!body.leadIds?.length) {
      return NextResponse.json({ ok: false, error: "leadIds required" }, { status: 400 });
    }

    const result = await runOutreach({
      campaignId: body.campaignId,
      name: body.name,
      messageTemplate: body.messageTemplate,
      channel: body.channel,
      leadIds: body.leadIds,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    logger.error("POST /api/outreach failed", { error: String(e) });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
