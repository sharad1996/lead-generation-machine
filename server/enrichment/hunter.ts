import { logger } from "@/lib/logger";

type HunterDomainResponse = {
  data?: { emails?: Array<{ value: string; confidence: number }> };
  errors?: Array<{ id: string; details: string }>;
};

export async function hunterFindEmailForDomain(domain: string): Promise<string | null> {
  const key = process.env.HUNTER_API_KEY;
  if (!key) {
    logger.debug("HUNTER_API_KEY not set; skipping Hunter");
    return null;
  }

  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("api_key", key);
  url.searchParams.set("limit", "5");

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    logger.warn("Hunter API error", { status: res.status, body: await res.text() });
    return null;
  }

  const json = (await res.json()) as HunterDomainResponse;
  const emails = json.data?.emails ?? [];
  if (!emails.length) return null;
  emails.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  return emails[0]?.value ?? null;
}
