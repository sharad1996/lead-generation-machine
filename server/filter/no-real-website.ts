import { Prisma } from "@prisma/client";
import type { RawLead } from "@/server/types/lead";

/**
 * URL substrings for Prisma `contains` (case-insensitive). Keep in sync with browser-side checks in the scraper.
 */
export const NO_REAL_WEBSITE_URL_SNIPPETS = [
  "maps.google",
  "google.com/maps",
  "business.google",
  "google.com/url?",
  "g.page/",
  "g.page?",
  "maps.app.goo.gl",
  "goo.gl/maps",
  "facebook.com",
  "fb.com",
  "instagram.com",
  "linkedin.com",
  "yelp.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "linktr.ee",
  "linktree.com",
  "wa.me",
  "whatsapp.com",
  "twitter.com",
  "x.com",
  "pinterest.com",
  "m.me",
  "sites.google.com",
  "blogspot.com",
  "wordpress.com",
  "wixsite.com",
  "square.site",
] as const;

/**
 * True = URL is not a standalone owned marketing site (Maps-only, Google properties, social, link-in-bio hosts, etc.).
 */
export function isNonQualifyingWebPresence(url: string | null | undefined): boolean {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return true;
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = u.hostname.toLowerCase();
    const full = u.href.toLowerCase();
    if (host === "google.com" || host.endsWith(".google.com")) return true;
    return NO_REAL_WEBSITE_URL_SNIPPETS.some((s) => full.includes(s.toLowerCase()));
  } catch {
    return true;
  }
}

/** Keep lead in the "no real website" outreach list. */
export function filterLead(lead: { website?: string | null }): boolean {
  return isNonQualifyingWebPresence(lead.website);
}

export function filterRawLeads(leads: RawLead[]): RawLead[] {
  return leads.filter((l) => filterLead({ website: l.website }));
}

/** Prisma filter: leads that count as no standalone site (matches {@link filterLead}). */
export function prismaWhereLeadNoRealWebsite(): Prisma.LeadWhereInput {
  return {
    OR: [
      { website: null },
      { website: { equals: "" } },
      ...NO_REAL_WEBSITE_URL_SNIPPETS.map((snippet) => ({
        website: { contains: snippet, mode: Prisma.QueryMode.insensitive },
      })),
    ],
  };
}
