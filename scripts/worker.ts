import "dotenv/config";
import { Worker } from "bullmq";
import { logger } from "../lib/logger";
import { SCRAPE_QUEUE_NAME, type ScrapeJobPayload } from "../server/jobs/queue";
import { runScrapePipeline } from "../server/jobs/pipeline";

const redis = process.env.REDIS_URL;
if (!redis) {
  logger.error("REDIS_URL is required for the BullMQ worker");
  process.exit(1);
}

const worker = new Worker<ScrapeJobPayload>(
  SCRAPE_QUEUE_NAME,
  async (job) => {
    logger.info("Processing scrape job", { id: job.id });
    const result = await runScrapePipeline(job.data);
    return result;
  },
  { connection: { url: redis } },
);

worker.on("completed", (job) => logger.info("Job completed", { id: job.id }));
worker.on("failed", (job, err) => logger.error("Job failed", { id: job?.id, error: String(err) }));

logger.info("BullMQ worker listening", { queue: SCRAPE_QUEUE_NAME });
