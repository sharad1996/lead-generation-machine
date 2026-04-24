"use client";

import { useEffect, useMemo, useState } from "react";

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  website: string | null;
  status: string;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [noWebsite, setNoWebsite] = useState(false);
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (noWebsite) p.set("noWebsite", "1");
    if (location.trim()) p.set("location", location.trim());
    if (status.trim()) p.set("status", status.trim());
    p.set("take", "100");
    return p.toString();
  }, [noWebsite, location, status]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/leads?${query}`)
      .then(async (r) => {
        const d = (await r.json()) as { ok?: boolean; leads?: Lead[]; hint?: string; error?: string };
        if (d.ok === false) {
          setLeads([]);
          setLoadError(d.hint || d.error || "Could not load leads");
          return;
        }
        setLeads(d.leads ?? []);
      })
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Filter and review ingested records.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={noWebsite} onChange={(e) => setNoWebsite(e.target.checked)} />
          No website / maps link only
        </label>
        <div className="flex flex-col text-sm">
          <span className="text-xs font-medium text-zinc-500">Location contains</span>
          <input
            className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Texas"
          />
        </div>
        <div className="flex flex-col text-sm">
          <span className="text-xs font-medium text-zinc-500">Status</span>
          <select
            className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Any</option>
            <option value="new">new</option>
            <option value="contacted">contacted</option>
            <option value="converted">converted</option>
          </select>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Database unavailable</p>
          <p className="mt-2 whitespace-pre-wrap">{loadError}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Website</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2 font-medium">{l.name}</td>
                  <td className="px-3 py-2">{l.phone ?? "—"}</td>
                  <td className="px-3 py-2">{l.email ?? "—"}</td>
                  <td className="px-3 py-2">{l.location ?? "—"}</td>
                  <td className="px-3 py-2 break-all">{l.website ?? "—"}</td>
                  <td className="px-3 py-2">{l.status}</td>
                </tr>
              ))}
              {!leads.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    No leads yet. Run the scraper to populate data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
