import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichLead } from "@/server/enrichment/enrich-lead";
import { BrowserPool } from "@/server/scraper/browser-pool";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { leadIds?: string[]; limit?: number };
    const limit = Math.min(body.limit ?? 20, 50);

    const leads = body.leadIds?.length
      ? await prisma.lead.findMany({ where: { id: { in: body.leadIds } } })
      : await prisma.lead.findMany({
          where: { email: null },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

    const pool = new BrowserPool({ maxConcurrent: 1 });
    await pool.init();

    const updated: string[] = [];

    try {
      await pool.withPage(async (browser) => {
        for (const lead of leads) {
          if (lead.email) continue;
          try {
            const enriched = await enrichLead(lead, { browser });
            if (enriched.email) {
              await prisma.lead.update({
                where: { id: lead.id },
                data: { email: enriched.email },
              });
              updated.push(lead.id);
            }
          } catch (e) {
            logger.warn("Enrich failed for lead", { id: lead.id, error: String(e) });
          }
        }
      });
    } finally {
      await pool.closeAll();
    }

    return NextResponse.json({ ok: true, processed: leads.length, updated });
  } catch (e) {
    logger.error("POST /api/enrich failed", { error: String(e) });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
