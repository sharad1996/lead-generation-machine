import { Queue, type JobsOptions } from "bullmq";
import { logger } from "@/lib/logger";

export const SCRAPE_QUEUE_NAME = "lead-scrape";

export type ScrapeJobPayload = {
  keywords: string[];
  locations: string[];
  maxPlacesPerQuery?: number;
  scrollRounds?: number;
  concurrency?: number;
  enrichAfterStore?: boolean;
  bypassWebsiteFilter?: boolean;
  category?: string | null;
};

let scrapeQueue: Queue<ScrapeJobPayload> | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function getScrapeQueue(): Queue<ScrapeJobPayload> | null {
  if (!isRedisConfigured()) return null;
  if (!scrapeQueue) {
    scrapeQueue = new Queue<ScrapeJobPayload>(SCRAPE_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return scrapeQueue;
}

export async function enqueueScrapeJob(
  payload: ScrapeJobPayload,
  opts?: JobsOptions,
): Promise<{ mode: "bullmq"; id: string } | { mode: "inline" }> {
  const q = getScrapeQueue();
  if (q) {
    const job = await q.add("scrape-maps", payload, opts);
    logger.info("Enqueued scrape job", { jobId: job.id });
    return { mode: "bullmq", id: String(job.id) };
  }
  return { mode: "inline" };
}
