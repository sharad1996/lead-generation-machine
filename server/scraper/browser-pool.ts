import puppeteer, { type Browser, type LaunchOptions } from "puppeteer";
import { logger } from "@/lib/logger";

export type BrowserPoolOptions = {
  maxConcurrent: number;
  /** e.g. http://user:pass@host:port for Bright Data / ScraperAPI */
  proxyServer?: string;
  /** Connect to remote browser (Bright Data browser) */
  browserWSEndpoint?: string;
  headless?: boolean | "shell";
};

type Slot = {
  browser: Browser;
  inUse: boolean;
};

async function waitForSlot(slots: Slot[]): Promise<Slot> {
  for (;;) {
    const free = slots.find((s) => !s.inUse);
    if (free) return free;
    await new Promise((r) => setTimeout(r, 40));
  }
}

/**
 * Manages a small pool of Puppeteer browsers for concurrent scraping.
 */
export class BrowserPool {
  private slots: Slot[] = [];
  private readonly opts: BrowserPoolOptions;

  constructor(opts: Partial<BrowserPoolOptions> = {}) {
    this.opts = {
      maxConcurrent: Math.max(1, opts.maxConcurrent ?? 2),
      proxyServer: opts.proxyServer ?? process.env.SCRAPER_PROXY_SERVER,
      browserWSEndpoint: opts.browserWSEndpoint ?? process.env.BROWSER_WS_ENDPOINT,
      headless: opts.headless ?? (process.env.PUPPETEER_HEADLESS === "0" ? false : "shell"),
    };
  }

  private async launchBrowser(): Promise<Browser> {
    const args = ["--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"];
    if (this.opts.proxyServer) {
      args.push(`--proxy-server=${this.opts.proxyServer}`);
    }

    if (this.opts.browserWSEndpoint) {
      logger.info("Connecting to remote browser", { endpoint: this.opts.browserWSEndpoint });
      return puppeteer.connect({
        browserWSEndpoint: this.opts.browserWSEndpoint,
      });
    }

    const customPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    // headless: "shell" matches the puppeteer-downloaded chrome-headless-shell binary.
    // A full Chrome/Chromium path needs classic headless (true) instead.
    const headless =
      customPath && !customPath.includes("chrome-headless-shell")
        ? this.opts.headless === false
          ? false
          : true
        : this.opts.headless;

    const launchOptions: LaunchOptions = {
      headless,
      args,
      defaultViewport: { width: 1280, height: 900 },
    };

    if (customPath) {
      launchOptions.executablePath = customPath;
    }

    try {
      return await puppeteer.launch(launchOptions);
    } catch (e) {
      const msg = String(e);
      if (msg.includes("Could not find Chrome")) {
        throw new Error(
          "Chrome for Puppeteer is not installed. Run: npm run browsers:install " +
            "(or: npx puppeteer browsers install chrome-headless-shell). " +
            "Alternatively set PUPPETEER_EXECUTABLE_PATH to a Chrome/Chromium binary.",
        );
      }
      throw e;
    }
  }

  async init(): Promise<void> {
    while (this.slots.length < this.opts.maxConcurrent) {
      const browser = await this.launchBrowser();
      this.slots.push({ browser, inUse: false });
    }
  }

  private async acquireSlot(): Promise<Browser> {
    const slot = await waitForSlot(this.slots);
    slot.inUse = true;
    return slot.browser;
  }

  private releaseBrowser(browser: Browser): void {
    const slot = this.slots.find((s) => s.browser === browser);
    if (slot) slot.inUse = false;
  }

  /**
   * Run work with an isolated page; releases slot when done.
   */
  async withPage<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
    const browser = await this.acquireSlot();
    try {
      return await fn(browser);
    } finally {
      this.releaseBrowser(browser);
    }
  }

  async closeAll(): Promise<void> {
    await Promise.all(
      this.slots.map(async (s) => {
        try {
          if (this.opts.browserWSEndpoint) {
            await s.browser.disconnect();
          } else {
            await s.browser.close();
          }
        } catch (e) {
          logger.warn("Browser close failed", { error: String(e) });
        }
      }),
    );
    this.slots = [];
  }
}
