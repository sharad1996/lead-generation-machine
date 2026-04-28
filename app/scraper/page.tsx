"use client";

import { useMemo, useState } from "react";
import { LOCATION_CATALOG, NICHE_PRESETS } from "@/lib/scraper-presets";

function parseCustomKeywords(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ScraperPage() {
  const [nicheId, setNicheId] = useState<string>(NICHE_PRESETS[0]?.id ?? "medical");
  const [customKeywordsText, setCustomKeywordsText] = useState(
    "wholesale industrial valves\ncommercial lighting supplier",
  );
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["Texas", "California"]);
  const [locationAddValue, setLocationAddValue] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [maxPlaces, setMaxPlaces] = useState(12);
  const [enrich, setEnrich] = useState(false);
  const [bypassFilter, setBypassFilter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const activeNiche = useMemo(() => NICHE_PRESETS.find((n) => n.id === nicheId) ?? NICHE_PRESETS[0], [nicheId]);

  const keywordsForScrape = useMemo(() => {
    if (nicheId === "custom") {
      return parseCustomKeywords(customKeywordsText);
    }
    return activeNiche.keywords;
  }, [nicheId, customKeywordsText, activeNiche.keywords]);

  const scrapeCategory = useMemo(
    () => (nicheId === "custom" ? "Custom keywords" : activeNiche.label),
    [nicheId, activeNiche.label],
  );

  function addLocation(value: string) {
    const v = value.trim();
    if (!v || selectedLocations.includes(v)) return;
    setSelectedLocations((prev) => [...prev, v]);
  }

  function removeLocation(value: string) {
    setSelectedLocations((prev) => prev.filter((x) => x !== value));
  }

  async function start() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: keywordsForScrape,
          locations: selectedLocations,
          maxPlacesPerQuery: maxPlaces,
          enrichAfterStore: enrich,
          bypassWebsiteFilter: bypassFilter,
          category: scrapeCategory,
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

  const canStart =
    keywordsForScrape.length > 0 && selectedLocations.length > 0 && !busy;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scraper control</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Choose a <strong>niche</strong> (preset search phrases) and one or more <strong>locations</strong> from the
          dropdowns. Add custom areas if your team targets specific cities or regions. Only businesses{" "}
          <strong>without a real website</strong> are saved by default.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Niche / industry</h2>
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Preset</label>
          <select
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            value={nicheId}
            onChange={(e) => setNicheId(e.target.value)}
          >
            {NICHE_PRESETS.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500">{activeNiche.description}</p>
          {nicheId !== "custom" && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Search phrases in this niche</p>
              <ul className="mt-2 list-inside list-disc text-xs text-zinc-600 dark:text-zinc-400">
                {activeNiche.keywords.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </div>
          )}
          {nicheId === "custom" && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Custom keywords (one per line or comma-separated)
              </label>
              <textarea
                className="mt-1 min-h-[120px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                value={customKeywordsText}
                onChange={(e) => setCustomKeywordsText(e.target.value)}
                placeholder="e.g. wholesale organic spices&#10;commercial bakery equipment"
              />
              <p className="mt-1 text-xs text-zinc-500">{keywordsForScrape.length} phrase(s) will be used.</p>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Locations (multi-select)</h2>
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Add from catalog
          </label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className="w-full flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              value={locationAddValue}
              onChange={(e) => {
                const v = e.target.value;
                setLocationAddValue(v);
                if (v) {
                  addLocation(v);
                  setLocationAddValue("");
                }
              }}
            >
              <option value="">Select a location to add…</option>
              {LOCATION_CATALOG.map((loc) => (
                <option key={loc} value={loc} disabled={selectedLocations.includes(loc)}>
                  {loc}
                  {selectedLocations.includes(loc) ? " (added)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Custom location</label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                className="w-full flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLocation(customLocation);
                    setCustomLocation("");
                  }
                }}
                placeholder="e.g. Austin TX, Cork Ireland, Singapore"
              />
              <button
                type="button"
                className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                onClick={() => {
                  addLocation(customLocation);
                  setCustomLocation("");
                }}
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Selected ({selectedLocations.length}) — click × to remove
            </p>
            <div className="mt-2 flex min-h-[44px] flex-wrap gap-2">
              {selectedLocations.map((loc) => (
                <span
                  key={loc}
                  className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-900 dark:bg-sky-900/40 dark:text-sky-100"
                >
                  {loc}
                  <button
                    type="button"
                    className="ml-0.5 rounded-full px-1 hover:bg-sky-200 dark:hover:bg-sky-800"
                    aria-label={`Remove ${loc}`}
                    onClick={() => removeLocation(loc)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {!selectedLocations.length && (
                <span className="text-xs text-zinc-500">Add at least one location to scrape.</span>
              )}
            </div>
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
            <strong>Include businesses that already have a website</strong> (turns off the “no website” filter).
          </span>
        </label>
        <button
          type="button"
          disabled={!canStart}
          onClick={start}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {busy ? "Running…" : "Start scraping"}
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        Run summary: <strong>{keywordsForScrape.length}</strong> keyword(s) × <strong>{selectedLocations.length}</strong>{" "}
        location(s) — Maps will open each combination (longer runs with many picks).
      </p>

      {result && (
        <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-xs text-emerald-200 dark:border-zinc-800">
          {result}
        </pre>
      )}
    </div>
  );
}
