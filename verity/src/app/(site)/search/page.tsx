"use client";

import React, { useMemo, useState } from "react";

type Result = {
  id: string;
  title: string;
  type: "bill" | "hansard" | "news" | "gazette";
  jur: "AU" | "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT";
  date: string; // YYYY-MM-DD
};

const MOCK_RESULTS: Result[] = [
  { id: "r1", title: "Budget Paper No.2 — SMEs", type: "bill", jur: "AU", date: "2024-05-14" },
  { id: "r2", title: "Hansard — Energy questions without notice", type: "hansard", jur: "AU", date: "2024-05-15" },
  { id: "r3", title: "NSW Gazette: coastal hazard adjustments", type: "gazette", jur: "NSW", date: "2025-07-11" },
  { id: "r4", title: "Treasurer media release — Indexation relief", type: "news", jur: "AU", date: "2025-05-13" },
];

const WATCH_KEY = "verity.watch";

export default function SearchPage() {
  const [q, setQ] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem("verity.lastQuery") || "";
    } catch {
      return "";
    }
  });

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return MOCK_RESULTS;
    return MOCK_RESULTS.filter(r => r.title.toLowerCase().includes(needle));
  }, [q]);

  function onSaveTerm() {
    try {
      if (typeof window === "undefined") return;
      const val = q.trim();
      if (!val) return;
      const raw = localStorage.getItem(WATCH_KEY);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      // de-dupe; newest first
      const filtered = arr.filter(v => v !== `search:${val}`);
      filtered.unshift(`search:${val}`);
      localStorage.setItem(WATCH_KEY, JSON.stringify(filtered.slice(0, 50)));
    } catch {}
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Search public records with citations</h1>

      <form
        onSubmit={e => {
          e.preventDefault();
          try {
            localStorage.setItem("verity.lastQuery", q);
          } catch {}
        }}
        className="mt-4 flex gap-2"
        role="search"
      >
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Try: energy rebate 2025; migration strategy; Misinformation Bill"
          className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-neutral-900 hover:bg-emerald-300"
        >
          Search
        </button>
        <button
          type="button"
          onClick={onSaveTerm}
          className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10"
          title="Add to Watchlist"
        >
          Watch this term
        </button>
      </form>

      <ul className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
        {results.length === 0 && (
          <li className="p-4 text-sm text-neutral-400">No results. Try another term.</li>
        )}
        {results.map(r => (
          <li key={r.id} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-neutral-400">
                  {r.type} • {r.jur} • {r.date}
                </div>
              </div>
              <div className="text-xs rounded-full border border-white/20 px-2 py-0.5 capitalize">
                {r.type}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
