import { logger } from "@/lib/logger";

type ApolloPeopleSearchResponse = {
  people?: Array<{ email?: string }>;
};

/**
 * Apollo.io people search (simplified). Requires APOLLO_API_KEY.
 */
export async function apolloFindEmailForOrganization(
  organizationName: string,
): Promise<string | null> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    logger.debug("APOLLO_API_KEY not set; skipping Apollo");
    return null;
  }

  const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": key,
    },
    body: JSON.stringify({
      q_organization_name: organizationName,
      page: 1,
      per_page: 3,
    }),
  });

  if (!res.ok) {
    logger.warn("Apollo API error", { status: res.status, body: await res.text() });
    return null;
  }

  const json = (await res.json()) as ApolloPeopleSearchResponse;
  const people = json.people ?? [];
  for (const p of people) {
    if (p.email && p.email.includes("@")) return p.email;
  }
  return null;
}
