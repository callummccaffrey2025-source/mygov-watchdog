"use client";

import React, { useEffect, useState } from "react";

const WATCH_KEY = "verity.watch";

export default function DashboardPage() {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = localStorage.getItem(WATCH_KEY);
      setItems(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);

  function removeItem(x: string) {
    const next = items.filter(v => v !== x);
    setItems(next);
    try {
      localStorage.setItem(WATCH_KEY, JSON.stringify(next));
    } catch {}
  }

  function openItem(x: string) {
    const term = x.replace(/^search:/, "");
    try {
      localStorage.setItem("verity.lastQuery", term);
      window.location.assign("/app/search"); // works with (site) segment mounted at /app
    } catch {}
  }

  const terms = items.filter(v => v.startsWith("search:"));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Your Watchlist</h1>
      <p className="text-neutral-400 text-sm">Saved search terms. Add more from the Search page.</p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="font-medium">Saved terms</div>
        {terms.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">
            Nothing yet. Go to <a href="/app/search" className="underline">Search</a> and click “Watch this term”.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {terms.map(x => {
              const label = x.replace(/^search:/, "");
              return (
                <li key={x} className="flex items-center justify-between text-sm">
                  <span className="truncate">{label}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openItem(x)}
                      className="rounded-lg border border-white/15 px-2 py-1 hover:bg-white/10 text-xs"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => removeItem(x)}
                      className="rounded-lg border border-white/15 px-2 py-1 hover:bg-white/10 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
