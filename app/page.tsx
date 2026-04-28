"use client";

import { useEffect, useState } from "react";

type Stats = {
  totalLeads: number;
  filteredLeadsNoWebsite: number;
  contacted: number;
  converted: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then(async (r) => {
        const data = (await r.json()) as Stats & { ok?: boolean; hint?: string; error?: string };
        if (data.ok === false) {
          setError(data.hint || data.error || "Stats unavailable");
          return;
        }
        setStats(data);
      })
      .catch(() => setError("Failed to load stats"));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">Database unreachable</p>
        <p className="mt-2 whitespace-pre-wrap">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return <p className="text-sm text-zinc-500">Loading dashboard…</p>;
  }

  const conversionRate =
    stats.totalLeads === 0 ? 0 : Math.round((stats.converted / stats.totalLeads) * 1000) / 10;

  const cards = [
    { label: "Total leads", value: stats.totalLeads },
    { label: "No real website (outreach list)", value: stats.filteredLeadsNoWebsite },
    { label: "Contacted", value: stats.contacted },
    { label: "Converted", value: stats.converted },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Track prospects <strong>without a proper website</strong> (your main pitch list), then enrich and reach out
          before competitors who only rely on Google Maps.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Conversion (converted ÷ total)</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{conversionRate}%</p>
      </div>
    </div>
  );
}
