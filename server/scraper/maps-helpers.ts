import type { Page } from "puppeteer";

async function pause(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Dismiss Google cookie / consent / before-you-continue overlays that block Maps.
 */
export async function dismissConsentAndInterstitials(page: Page): Promise<number> {
  let clicks = 0;
  for (let attempt = 0; attempt < 10; attempt++) {
    const clicked = await page.evaluate(() => {
      const clickEl = (el: Element | null) => {
        if (!el) return false;
        const h = el as HTMLElement;
        if (h.offsetParent === null && h.tagName !== "BODY") return false;
        h.click();
        return true;
      };

      const ids = ["L2AGLb", "introAgreeButton", "W0wltc"];
      for (const id of ids) {
        if (clickEl(document.getElementById(id))) return true;
      }

      const ariaAccept = document.querySelector<HTMLElement>(
        '[aria-label="Accept all"],[aria-label*="ccept all" i],[aria-label*="Agree" i]',
      );
      if (clickEl(ariaAccept)) return true;

      const patterns = [
        /accept all/i,
        /accept all cookies/i,
        /i agree/i,
        /got it/i,
        /^accept$/i,
        /tout accepter/i,
        /alle akzeptieren/i,
        /reject all/i,
      ];
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>("button, [role='button'], div[role='button'], input[type='button']"),
      );
      for (const el of nodes) {
        const t = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
        if (!t || t.length > 120) continue;
        if (patterns.some((re) => re.test(t))) {
          el.click();
          return true;
        }
      }

      const formBtn = document.querySelector<HTMLElement>('form[action*="consent"] button, form[action*="Consent"] button');
      if (clickEl(formBtn)) return true;

      return false;
    });
    if (!clicked) break;
    clicks++;
    await pause(600);
  }

  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Escape").catch(() => undefined);
    await pause(200);
  }

  return clicks;
}

export type LinkHarvest = {
  urls: string[];
  warnings: string[];
};

function normalizePlaceHref(href: string): string | null {
  if (!href || href === "#" || href.startsWith("javascript:")) return null;
  try {
    if (href.includes("/maps/place/")) {
      let u = href;
      if (u.startsWith("/")) u = `https://www.google.com${u}`;
      if (u.startsWith("./")) u = `https://www.google.com/${u.slice(2)}`;
      return u.split("?")[0].split("#")[0];
    }
    if (href.includes("q=") && (href.includes("url?") || href.includes("/url?"))) {
      const m = href.match(/[?&]q=([^&]+)/);
      if (m) {
        const decoded = decodeURIComponent(m[1]);
        if (decoded.includes("/maps/place/")) {
          return decoded.split("?")[0].split("#")[0];
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Collect place URLs from anchors, role=link, and raw HTML (Maps embeds URLs in JSON/script).
 */
export async function harvestPlaceLinksFromSearchPage(page: Page, limit: number): Promise<LinkHarvest> {
  const warnings: string[] = [];

  const fromDom = await page.evaluate((max: number) => {
    const out: string[] = [];
    const add = (href: string) => {
      if (!href) return;
      let normalized: string | null = null;
      try {
        if (href.includes("/maps/place/")) {
          let u = href;
          if (u.startsWith("/")) u = `https://www.google.com${u}`;
          if (u.startsWith("./")) u = `https://www.google.com/${u.slice(2)}`;
          normalized = u.split("?")[0].split("#")[0];
        } else if (href.includes("q=") && (href.includes("url?") || href.includes("/url?"))) {
          const m = href.match(/[?&]q=([^&]+)/);
          if (m) {
            const decoded = decodeURIComponent(m[1]);
            if (decoded.includes("/maps/place/")) {
              normalized = decoded.split("?")[0].split("#")[0];
            }
          }
        }
      } catch {
        return;
      }
      if (normalized && !out.includes(normalized)) out.push(normalized);
    };

    document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => add(a.href));
    document.querySelectorAll("[role='link'][href]").forEach((el) => {
      const h = (el as HTMLAnchorElement).href;
      if (h) add(h);
    });

    return out.slice(0, max);
  }, limit);

  const merged = new Set(fromDom);
  let htmlSample = "";
  try {
    const html = await page.content();
    htmlSample = html.length > 500_000 ? html.slice(0, 500_000) : html;
    const re = /https:\/\/(www\.)?google\.com\/maps\/place\/[^"'\\s<>&]+/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(htmlSample)) !== null && merged.size < limit) {
      const raw = m[0].replace(/\\u002F/g, "/");
      const n = normalizePlaceHref(raw);
      if (n) merged.add(n);
    }
  } catch {
    /* ignore */
  }

  const urls = Array.from(merged).slice(0, limit);

  if (!urls.length) {
    warnings.push(
      "No /maps/place/ links found (DOM + page HTML scan). Maps may be blocking automation (captcha), use a different region, or try PUPPETEER_HEADLESS=0.",
    );
  }

  return { urls, warnings };
}

/**
 * Wait until Maps exposes at least one place link or a known results shell.
 */
export async function waitForSearchResultsOrWarn(page: Page, timeoutMs: number): Promise<string[]> {
  const warnings: string[] = [];
  try {
    await page.waitForFunction(
      () => {
        const n = document.querySelectorAll(
          'a[href*="/maps/place/"], a[href*="maps.google.com/maps/place/"]',
        ).length;
        const feed = document.querySelector('div[role="feed"]');
        return n >= 1 || !!feed;
      },
      { timeout: timeoutMs, polling: 800 },
    );
  } catch {
    warnings.push(
      `Timed out (${timeoutMs}ms) waiting for Maps results (place links or feed). Try headed mode: PUPPETEER_HEADLESS=0 in .env.`,
    );
  }
  return warnings;
}

/**
 * Scroll the main results column; falls back to window scroll if feed node missing.
 */
export async function scrollMapsResults(page: Page, rounds: number): Promise<void> {
  const feedHandle = (await page.$('div[role="feed"]')) ?? (await page.$(".m6QErb"));
  if (feedHandle) {
    for (let i = 0; i < rounds; i++) {
      await page.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      }, feedHandle);
      await pause(700 + Math.random() * 400);
    }
    await feedHandle.dispose().catch(() => undefined);
    return;
  }

  const main = await page.$('[role="main"]');
  if (main) {
    for (let i = 0; i < Math.min(rounds, 6); i++) {
      await page.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      }, main);
      await pause(800);
    }
    await main.dispose().catch(() => undefined);
    return;
  }

  for (let i = 0; i < Math.min(rounds, 4); i++) {
    await page.evaluate(() => window.scrollBy(0, 900));
    await pause(500);
  }
}
