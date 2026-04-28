import type { Browser, Page } from "puppeteer";
import { logger } from "@/lib/logger";
import type { RawLead } from "@/server/types/lead";
import { NO_REAL_WEBSITE_URL_SNIPPETS } from "@/server/filter/no-real-website";
import { resolveLeadNameFromMaps } from "@/server/scraper/resolve-lead-name";
import {
  dismissConsentAndInterstitials,
  harvestPlaceLinksFromSearchPage,
  scrollMapsResults,
  waitForSearchResultsOrWarn,
} from "@/server/scraper/maps-helpers";

const DEFAULT_SCROLL_ROUNDS = 10;
const NAV_TIMEOUT_MS = 60_000;
const SELECTOR_TIMEOUT_MS = 25_000;
const RESULTS_WAIT_MS = 45_000;

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function withRetries<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      logger.warn(`${label} attempt ${i}/${attempts} failed`, { error: String(e) });
      await sleep(800 * i);
    }
  }
  throw last;
}

function buildSearchUrl(keyword: string, location: string): string {
  const q = `${keyword} ${location}`.trim();
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

/**
 * Extract listing fields from a place details page using multiple DOM strategies.
 */
async function scrapePlacePage(page: Page, placeUrl: string, contextLocation: string): Promise<RawLead | null> {
  await withRetries(
    `goto ${placeUrl}`,
    async () => {
      await page.goto(placeUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    },
    3,
  );

  await dismissConsentAndInterstitials(page);
  await sleep(1200);

  const snippetList = [...NO_REAL_WEBSITE_URL_SNIPPETS];

  const data = await page.evaluate((snippets: string[]) => {
    const snippetsLower = snippets.map((s) => s.toLowerCase());
    const isBlockedHref = (href: string): boolean => {
      const h = href.toLowerCase();
      if (h.includes("google.com/maps") || h.includes("maps.google")) return true;
      if (snippetsLower.some((s) => h.includes(s))) return true;
      try {
        const u = new URL(href);
        const host = u.hostname.toLowerCase();
        if (host === "google.com" || host.endsWith(".google.com")) return true;
      } catch {
        return true;
      }
      return false;
    };
    const pickText = (selectors: string[]): string | null => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) return el.textContent.trim();
      }
      return null;
    };

    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() ?? null;

    const title =
      pickText([
        "h1.DUwDvf",
        "h1.qrShPb",
        "h1.fontHeadlineLarge",
        "h1.fontHeadlineMedium",
        '[data-attrid="title"]',
        "h1.fontHeadlineSmall",
        '[role="main"] h1',
        "h1[class*='Headline']",
        "h1",
      ]) ??
      ogTitle ??
      null;

    const ratingText =
      pickText([
        "div.F7nice span[aria-hidden='true']",
        "span[aria-label*='stars']",
        "div.fontBodyMedium span[aria-hidden='true']",
      ]) ?? null;

    let rating: number | null = null;
    if (ratingText) {
      const m = ratingText.replace(",", ".").match(/(\d+(\.\d+)?)/);
      if (m) rating = parseFloat(m[1]);
    }

    let phone: string | null = null;
    const phoneCandidates = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"], button[data-item-id="phone"]'),
    );
    for (const el of phoneCandidates) {
      const href = el.getAttribute("href");
      if (href?.startsWith("tel:")) {
        phone = href.replace("tel:", "").trim();
        break;
      }
      const t = el.textContent?.trim();
      if (t && /\+?\d[\d\s().-]{7,}\d/.test(t)) {
        phone = t;
        break;
      }
    }

    let website: string | null = null;
    const authority = document.querySelector<HTMLAnchorElement>('a[data-item-id="authority"]');
    if (authority?.href) {
      const clean = authority.href.split("?")[0];
      if (!isBlockedHref(clean)) website = clean;
    }
    if (!website) {
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'));
      for (const a of anchors) {
        const href = a.href.split("?")[0];
        if (!href || isBlockedHref(href)) continue;
        website = href;
        break;
      }
    }

    let address: string | null = null;
    const addrBtn = document.querySelector<HTMLElement>('button[data-item-id="address"]');
    if (addrBtn?.textContent) address = addrBtn.textContent.trim();
    if (!address) {
      address =
        pickText([
          'button[data-item-id="address"]',
          '[data-tooltip="Copy address"]',
          "div.Io6YTe.fontBodyMedium",
        ]) ?? null;
    }

    return { title, rating, phone, website, address };
  }, snippetList);

  const name = resolveLeadNameFromMaps(data.title, placeUrl);
  if (!data.title?.trim()) {
    logger.info("Place page title weak or empty; resolved name from URL or fallback", {
      placeUrl,
      resolvedName: name,
    });
  }

  return {
    name,
    mapsLink: placeUrl,
    phone: data.phone,
    website: data.website,
    address: data.address,
    rating: data.rating,
    location: contextLocation,
  };
}

export type ScrapeOptions = {
  keywords: string[];
  locations: string[];
  /** Max place detail pages per keyword+location pair */
  maxPlacesPerQuery?: number;
  scrollRounds?: number;
};

export type ScrapeProgress = {
  query: string;
  foundLinks: number;
  scrapedPlaces: number;
};

export type ScrapeDiagnostics = {
  source: "google_maps_search";
  lastSearchUrl: string | null;
  /** Unique /maps/place/ URLs seen for the last query (before per-place cap). */
  placeLinksHarvested: number;
  consentButtonClicks: number;
  warnings: string[];
};

/**
 * Scrape Google Maps for the given keywords and locations.
 * Note: Automated scraping may violate Google Maps Terms of Service; use responsibly and consider official APIs.
 */
export async function scrapeGoogleMaps(
  browser: Browser,
  options: ScrapeOptions,
  onProgress?: (p: ScrapeProgress) => void,
): Promise<{ leads: RawLead[]; diagnostics: ScrapeDiagnostics }> {
  const maxPlaces = options.maxPlacesPerQuery ?? 25;
  const scrollRounds = options.scrollRounds ?? DEFAULT_SCROLL_ROUNDS;
  const results: RawLead[] = [];
  const seen = new Set<string>();

  const diagnostics: ScrapeDiagnostics = {
    source: "google_maps_search",
    lastSearchUrl: null,
    placeLinksHarvested: 0,
    consentButtonClicks: 0,
    warnings: [],
  };

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-CH-UA": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"macOS"',
  });
  await page.setUserAgent(
    process.env.SCRAPER_USER_AGENT ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  );
  page.setDefaultTimeout(SELECTOR_TIMEOUT_MS);

  try {
    for (const keyword of options.keywords) {
      for (const location of options.locations) {
        const url = buildSearchUrl(keyword, location);
        diagnostics.lastSearchUrl = url;
        logger.info("Maps search", { url });

        await withRetries(
          "maps search navigation",
          async () => {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
          },
          3,
        );

        await sleep(1200);
        diagnostics.consentButtonClicks += await dismissConsentAndInterstitials(page);
        await sleep(800);
        diagnostics.consentButtonClicks += await dismissConsentAndInterstitials(page);

        const waitWarnings = await waitForSearchResultsOrWarn(page, RESULTS_WAIT_MS);
        diagnostics.warnings.push(...waitWarnings);

        await sleep(2500);
        diagnostics.consentButtonClicks += await dismissConsentAndInterstitials(page);

        await scrollMapsResults(page, scrollRounds);

        const harvest1 = await harvestPlaceLinksFromSearchPage(page, maxPlaces * 6);
        diagnostics.warnings.push(...harvest1.warnings);

        await scrollMapsResults(page, Math.min(6, scrollRounds));
        await sleep(1500);
        const harvest2 = await harvestPlaceLinksFromSearchPage(page, maxPlaces * 6);
        diagnostics.warnings.push(...harvest2.warnings);

        const combinedUrls = Array.from(new Set([...harvest1.urls, ...harvest2.urls]));

        const uniqueLinks = combinedUrls.filter((l) => {
          if (seen.has(l)) return false;
          seen.add(l);
          return true;
        });

        diagnostics.placeLinksHarvested = Math.max(diagnostics.placeLinksHarvested, uniqueLinks.length);

        onProgress?.({
          query: `${keyword} @ ${location}`,
          foundLinks: uniqueLinks.length,
          scrapedPlaces: 0,
        });

        if (!uniqueLinks.length) {
          diagnostics.warnings.push(
            `No listing URLs for query "${keyword}" in "${location}". If you see Maps in a normal browser, try headed mode (PUPPETEER_HEADLESS=0) or a residential proxy.`,
          );
        }

        let count = 0;
        for (const link of uniqueLinks) {
          if (count >= maxPlaces) break;
          try {
            const lead = await scrapePlacePage(page, link, location);
            if (lead) {
              results.push(lead);
              count++;
            }
          } catch (e) {
            logger.error("Failed place scrape", { link, error: String(e) });
          }
          onProgress?.({
            query: `${keyword} @ ${location}`,
            foundLinks: uniqueLinks.length,
            scrapedPlaces: count,
          });
        }
      }
    }
  } finally {
    await page.close().catch(() => undefined);
  }

  return { leads: results, diagnostics };
}
