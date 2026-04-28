import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { appendLeadToSheet } from "@/server/integrations/google-sheets";
import { filterRawLeads } from "@/server/filter/filter-lead";
import { BrowserPool } from "@/server/scraper/browser-pool";
import {
  scrapeGoogleMaps,
  type ScrapeDiagnostics,
  type ScrapeOptions,
} from "@/server/scraper/google-maps-scraper";
import { resolveLeadNameFromMaps } from "@/server/scraper/resolve-lead-name";
import { enrichLead } from "@/server/enrichment/enrich-lead";

export type ScrapePipelineInput = ScrapeOptions & {
  concurrency?: number;
  enrichAfterStore?: boolean;
  /** When true, store every scraped lead (ignore no-website filter). */
  bypassWebsiteFilter?: boolean;
  /** Shown on leads (niche preset label or custom scrape label). */
  category?: string | null;
};

export type ScrapePipelineResult = {
  rawCount: number;
  filteredCount: number;
  insertedCount: number;
  /** Leads removed by the “no real website” filter (raw − filtered). */
  droppedByFilter: number;
  insertedIds: string[];
  diagnostics: ScrapeDiagnostics | null;
};

/**
 * scrape → filter → store (→ optional enrich → optional Sheets).
 */
export async function runScrapePipeline(input: ScrapePipelineInput): Promise<ScrapePipelineResult> {
  const pool = new BrowserPool({
    maxConcurrent: input.concurrency ?? Number(process.env.SCRAPER_CONCURRENCY || "2"),
  });
  await pool.init();

  let raw: Awaited<ReturnType<typeof scrapeGoogleMaps>>["leads"] = [];
  let diagnostics: Awaited<ReturnType<typeof scrapeGoogleMaps>>["diagnostics"] | null = null;
  try {
    const out = await pool.withPage((browser) =>
      scrapeGoogleMaps(browser, {
        keywords: input.keywords,
        locations: input.locations,
        maxPlacesPerQuery: input.maxPlacesPerQuery,
        scrollRounds: input.scrollRounds,
      }),
    );
    raw = out.leads;
    diagnostics = out.diagnostics;
  } finally {
    await pool.closeAll();
  }

  const bypass =
    input.bypassWebsiteFilter === true || process.env.SCRAPER_BYPASS_WEBSITE_FILTER === "1";
  const filtered = bypass ? raw : filterRawLeads(raw);
  const insertedIds: string[] = [];

  for (const lead of filtered) {
    const existing = lead.mapsLink
      ? await prisma.lead.findFirst({ where: { mapsLink: lead.mapsLink } })
      : null;
    if (existing) {
      logger.debug("Skip duplicate lead", { mapsLink: lead.mapsLink });
      continue;
    }

    const created = await prisma.lead.create({
      data: {
        name: resolveLeadNameFromMaps(lead.name, lead.mapsLink),
        category: input.category?.trim() ? input.category.trim() : undefined,
        phone: lead.phone ?? undefined,
        website: lead.website ?? undefined,
        mapsLink: lead.mapsLink,
        address: lead.address ?? undefined,
        location: lead.location ?? undefined,
        rating: lead.rating ?? undefined,
        source: "google_maps",
        status: "new",
      },
    });
    insertedIds.push(created.id);

    await appendLeadToSheet({
      name: created.name,
      category: created.category,
      phone: created.phone,
      email: created.email,
      website: created.website,
      address: created.address,
      location: created.location,
      rating: created.rating,
      status: created.status,
      mapsLink: created.mapsLink,
    }).catch((e) => logger.warn("Sheets append failed", { error: String(e) }));
  }

  if (input.enrichAfterStore && insertedIds.length) {
    const enrichPool = new BrowserPool({ maxConcurrent: 1 });
    await enrichPool.init();
    try {
      await enrichPool.withPage(async (browser) => {
        for (const id of insertedIds) {
          const lead = await prisma.lead.findUnique({ where: { id } });
          if (!lead || lead.email) continue;
          const enriched = await enrichLead(lead, { browser });
          if (enriched.email) {
            await prisma.lead.update({ where: { id }, data: { email: enriched.email } });
          }
        }
      });
    } finally {
      await enrichPool.closeAll();
    }
  }

  return {
    rawCount: raw.length,
    filteredCount: filtered.length,
    insertedCount: insertedIds.length,
    droppedByFilter: bypass ? 0 : Math.max(0, raw.length - filtered.length),
    insertedIds,
    diagnostics,
  };
}
