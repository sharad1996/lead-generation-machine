import type { RawLead } from "@/server/types/lead";

/**
 * Keep leads with no real website (NULL/empty) or only a Google Maps URL.
 */
export function filterLead(lead: { website?: string | null }): boolean {
  const w = lead.website?.trim();
  if (!w) return true;
  const lower = w.toLowerCase();
  if (lower.includes("maps.google")) return true;
  return false;
}

export function filterRawLeads(leads: RawLead[]): RawLead[] {
  return leads.filter((l) => filterLead({ website: l.website }));
}
