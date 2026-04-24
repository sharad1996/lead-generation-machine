import cron from "node-cron";
import { logger } from "@/lib/logger";
import { enqueueScrapeJob } from "@/server/jobs/queue";
import { runScrapePipeline } from "@/server/jobs/pipeline";

let started = false;

function parseJsonArray(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v as string[];
  } catch {
    /* ignore */
  }
  return fallback;
}

/**
 * Daily scrape schedule. Uses BullMQ when REDIS_URL is set (worker must run), otherwise runs inline.
 */
export function startCronJobs(): void {
  if (started) return;
  started = true;

  const expression = process.env.SCRAPE_CRON_EXPRESSION || "0 3 * * *";
  if (process.env.ENABLE_CRON !== "1") {
    logger.info("Cron disabled (set ENABLE_CRON=1 to activate)");
    return;
  }

  cron.schedule(expression, async () => {
    const keywords = parseJsonArray(process.env.SCRAPER_CRON_KEYWORDS, [
      "medical distributor",
      "pharma distributor",
    ]);
    const locations = parseJsonArray(process.env.SCRAPER_CRON_LOCATIONS, ["Texas", "California"]);

    logger.info("Cron scrape tick", { keywords, locations });

    try {
      if (process.env.REDIS_URL) {
        await enqueueScrapeJob({
          keywords,
          locations,
          maxPlacesPerQuery: Number(process.env.SCRAPER_MAX_PLACES || "15"),
        });
      } else {
        await runScrapePipeline({
          keywords,
          locations,
          maxPlacesPerQuery: Number(process.env.SCRAPER_MAX_PLACES || "15"),
          enrichAfterStore: process.env.SCRAPER_CRON_ENRICH === "1",
        });
      }
    } catch (e) {
      logger.error("Cron scrape failed", { error: String(e) });
    }
  });

  logger.info("Cron registered", { expression });
}
