import { NextResponse } from "next/server";
import { enqueueScrapeJob } from "@/server/jobs/queue";
import { runScrapePipeline } from "@/server/jobs/pipeline";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_KEYWORDS = [
  "medical distributor",
  "pharma distributor",
  "surgical supplier",
  "hospital equipment supplier",
  "medical wholesaler",
];

const DEFAULT_LOCATIONS = ["Texas", "California", "Florida", "New York"];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      keywords?: string[];
      locations?: string[];
      maxPlacesPerQuery?: number;
      scrollRounds?: number;
      concurrency?: number;
      enrichAfterStore?: boolean;
      bypassWebsiteFilter?: boolean;
      async?: boolean;
    };

    const keywords = body.keywords?.length ? body.keywords : DEFAULT_KEYWORDS;
    const locations = body.locations?.length ? body.locations : DEFAULT_LOCATIONS;

    const payload = {
      keywords,
      locations,
      maxPlacesPerQuery: body.maxPlacesPerQuery,
      scrollRounds: body.scrollRounds,
      concurrency: body.concurrency,
      enrichAfterStore: body.enrichAfterStore,
      bypassWebsiteFilter: body.bypassWebsiteFilter,
    };

    const wantsQueue = body.async !== false && process.env.REDIS_URL;

    if (wantsQueue) {
      const enq = await enqueueScrapeJob(payload);
      if (enq.mode === "bullmq") {
        return NextResponse.json({ ok: true, queued: true, jobId: enq.id });
      }
    }

    logger.info("Running scrape pipeline inline");
    const result = await runScrapePipeline(payload);
    return NextResponse.json({ ok: true, queued: false, result });
  } catch (e) {
    logger.error("POST /api/scrape failed", { error: String(e) });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
