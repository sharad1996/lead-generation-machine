"use client";

import { useState } from "react";

const KEYWORD_OPTIONS = [
  "medical distributor",
  "pharma distributor",
  "surgical supplier",
  "hospital equipment supplier",
  "medical wholesaler",
];

const LOCATION_OPTIONS = [
  "Texas",
  "California",
  "Florida",
  "New York",
  "London",
  "Birmingham",
  "Manchester",
  "Dubai",
  "Abu Dhabi",
  "Sharjah",
];

export default function ScraperPage() {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(["medical distributor"]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["Texas"]);
  const [maxPlaces, setMaxPlaces] = useState(12);
  const [enrich, setEnrich] = useState(false);
  const [bypassFilter, setBypassFilter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function toggle(list: string[], value: string, setter: (v: string[]) => void) {
    if (list.includes(value)) setter(list.filter((x) => x !== value));
    else setter([...list, value]);
  }

  async function start() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: selectedKeywords,
          locations: selectedLocations,
          maxPlacesPerQuery: maxPlaces,
          enrichAfterStore: enrich,
          bypassWebsiteFilter: bypassFilter,
          async: false,
        }),
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (e) {
      setResult(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scraper control</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Runs Puppeteer against Google Maps. The API response includes{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">result.diagnostics</code> (URLs found, consent
          clicks, warnings) so you can see whether Maps returned listings. By default we store leads even if they have a
          website (see checkbox below); turn it off to only keep “no website / maps link” businesses.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Keywords</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {KEYWORD_OPTIONS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => toggle(selectedKeywords, k, setSelectedKeywords)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  selectedKeywords.includes(k)
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Locations</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOCATION_OPTIONS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => toggle(selectedLocations, k, setSelectedLocations)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  selectedLocations.includes(k)
                    ? "bg-sky-600 text-white"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="text-sm">
          Max places / query
          <input
            type="number"
            min={1}
            max={40}
            className="ml-2 w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            value={maxPlaces}
            onChange={(e) => setMaxPlaces(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enrich} onChange={(e) => setEnrich(e.target.checked)} />
          Enrich after store
        </label>
        <label className="flex max-w-md items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={bypassFilter}
            onChange={(e) => setBypassFilter(e.target.checked)}
            className="mt-1"
          />
          <span>
            Store <strong>all</strong> scraped leads (bypass “no website” filter). Turn off to only save businesses
            without a real website — many distributors have sites, so the filter often drops everything.
          </span>
        </label>
        <button
          type="button"
          disabled={busy || !selectedKeywords.length || !selectedLocations.length}
          onClick={start}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {busy ? "Running…" : "Start scraping"}
        </button>
      </div>

      {result && (
        <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-xs text-emerald-200 dark:border-zinc-800">
          {result}
        </pre>
      )}
    </div>
  );
}
