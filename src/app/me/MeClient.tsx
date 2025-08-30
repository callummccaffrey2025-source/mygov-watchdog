'use client';

import { useEffect, useState } from 'react';

type FeedItem = { id: string; title: string; url: string; jurisdiction: string; created_at: string };

export default function MeClient() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/feed?jurisdiction=AU', { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed to load feed');
        setItems(j.items || []);
      } catch (e: any) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">My Brief</h1>
        <p className="text-sm text-zinc-600">Trending items tailored to you. Update preferences to personalize further.</p>
      </header>

      {loading && <div className="rounded border p-4">Loading…</div>}
      {err && <div className="rounded border border-red-300 bg-red-50 p-4 text-red-700">{err}</div>}

      <div className="grid gap-3">
        {items.map(it => (
          <a key={it.id} href={it.url} target="_blank" className="block rounded-lg border p-4 hover:bg-zinc-50">
            <div className="text-sm text-zinc-500">{new Date(it.created_at).toLocaleString()} • {it.jurisdiction}</div>
            <div className="mt-1 text-lg font-medium">{it.title}</div>
            <div className="mt-1 text-xs text-zinc-500 line-clamp-1">{it.url}</div>
          </a>
        ))}
        {!loading && items.length === 0 && (
          <div className="rounded border p-4">No items yet. Add sources and try again.</div>
        )}
      </div>
    </main>
  );
}
