import { logger } from "@/lib/logger";

export type LinkedInOutreachParams = {
  leadName: string;
  message: string;
};

/**
 * LinkedIn automation is restricted by platform policy. This records intent for manual or partner workflow.
 */
export async function queueLinkedInOutreach(
  params: LinkedInOutreachParams,
): Promise<{ status: "queued_placeholder" }> {
  logger.info("[LinkedIn placeholder] outreach queued", {
    leadName: params.leadName,
    preview: params.message.slice(0, 120),
  });
  return { status: "queued_placeholder" };
}
