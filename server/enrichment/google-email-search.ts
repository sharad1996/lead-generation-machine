import type { Page } from "puppeteer";
import { logger } from "@/lib/logger";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function scoreEmail(email: string, businessName: string): number {
  let score = 0;
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (local === "info" || local === "contact" || local === "sales") score += 2;
  const tokens = businessName.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  for (const t of tokens) {
    if (domain.includes(t.slice(0, 6))) score += 1;
  }
  return score;
}

/**
 * Open Google web search and try to find a public email in snippets / page text.
 */
export async function findEmailViaGoogleSearch(
  page: Page,
  businessName: string,
  locationHint?: string | null,
): Promise<string | null> {
  const q = locationHint
    ? `"${businessName}" ${locationHint} email`
    : `"${businessName}" email`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForSelector("body", { timeout: 10_000 });
  } catch (e) {
    logger.warn("Google search navigation failed", { error: String(e) });
    return null;
  }

  const text = await page.evaluate(() => document.body.innerText);
  const matches = text.match(EMAIL_RE) ?? [];
  const block = new Set(["example.com", "sentry.io", "w3.org", "schema.org", "google.com"]);
  const candidates = matches.filter((m) => {
    const domain = m.split("@")[1]?.toLowerCase() ?? "";
    return !block.has(domain) && !domain.endsWith("google.com");
  });

  if (!candidates.length) return null;

  const ranked = Array.from(new Set(candidates)).sort(
    (a, b) => scoreEmail(b, businessName) - scoreEmail(a, businessName),
  );
  return ranked[0] ?? null;
}
