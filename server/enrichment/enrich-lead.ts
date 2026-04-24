import type { Lead } from "@prisma/client";
import type { Browser } from "puppeteer";
import { logger } from "@/lib/logger";
import { apolloFindEmailForOrganization } from "@/server/enrichment/apollo";
import { hunterFindEmailForDomain } from "@/server/enrichment/hunter";
import { findEmailViaGoogleSearch } from "@/server/enrichment/google-email-search";

function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    const host = u.hostname.replace(/^www\./, "");
    if (!host || host.includes("google.")) return null;
    return host;
  } catch {
    return null;
  }
}

export type EnrichLeadOptions = {
  browser?: Browser;
  skipGoogle?: boolean;
  skipHunter?: boolean;
  skipApollo?: boolean;
};

/**
 * Attempt to discover an email using Google result scraping, Hunter, then Apollo.
 */
export async function enrichLead(lead: Lead, options: EnrichLeadOptions = {}): Promise<Lead> {
  if (lead.email) return lead;

  let email: string | null = null;

  const domain = extractDomain(lead.website);
  if (!options.skipHunter && domain) {
    email = await hunterFindEmailForDomain(domain);
  }

  if (!email && !options.skipApollo) {
    email = await apolloFindEmailForOrganization(lead.name);
  }

  if (!email && !options.skipGoogle && options.browser) {
    const page = await options.browser.newPage();
    try {
      email = await findEmailViaGoogleSearch(page, lead.name, lead.location);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  if (!email) {
    logger.info("Enrichment produced no email", { leadId: lead.id, name: lead.name });
    return lead;
  }

  return { ...lead, email };
}
