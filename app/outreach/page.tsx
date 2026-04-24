"use client";

import { useEffect, useState } from "react";
import { DEFAULT_WEB_PRESENCE_TEMPLATE } from "@/lib/outreach-templates";

type Lead = { id: string; name: string; email: string | null; phone: string | null; status: string };

export default function OutreachPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [template, setTemplate] = useState(DEFAULT_WEB_PRESENCE_TEMPLATE);
  const [channel, setChannel] = useState<"email" | "whatsapp" | "linkedin">("email");
  const [campaignName, setCampaignName] = useState("Web presence outreach");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leads?take=200")
      .then((r) => r.json())
      .then((d) => setLeads(d.leads ?? []));
  }, []);

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k);

  async function send() {
    setBusy(true);
    setLog(null);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          messageTemplate: template,
          channel,
          leadIds: selectedIds,
        }),
      });
      const json = await res.json();
      setLog(JSON.stringify(json, null, 2));
    } catch (e) {
      setLog(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outreach</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Compose a template and select leads. Use <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{"{{businessName}}"}</code>{" "}
          and <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{"{{location}}"}</code> placeholders.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="block text-sm font-medium">Campaign name</label>
          <input
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
          />
          <label className="block text-sm font-medium">Channel</label>
          <select
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={channel}
            onChange={(e) => setChannel(e.target.value as typeof channel)}
          >
            <option value="email">Email (NodeMailer)</option>
            <option value="whatsapp">WhatsApp (Twilio or log)</option>
            <option value="linkedin">LinkedIn (placeholder)</option>
          </select>
          <label className="block text-sm font-medium">Message template</label>
          <textarea
            className="min-h-[180px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !selectedIds.length}
            onClick={send}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send to selected"}
          </button>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Select leads</h2>
          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto text-sm">
            {leads.map((l) => (
              <label key={l.id} className="flex items-start gap-2 rounded-md border border-zinc-100 p-2 dark:border-zinc-800">
                <input
                  type="checkbox"
                  checked={!!selected[l.id]}
                  onChange={(e) => setSelected((s) => ({ ...s, [l.id]: e.target.checked }))}
                />
                <span>
                  <span className="font-medium">{l.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {l.email ?? "no email"} · {l.phone ?? "no phone"} · {l.status}
                  </span>
                </span>
              </label>
            ))}
            {!leads.length && <p className="text-sm text-zinc-500">No leads loaded.</p>}
          </div>
        </div>
      </div>

      {log && (
        <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-xs text-emerald-200 dark:border-zinc-800">
          {log}
        </pre>
      )}
    </div>
  );
}
