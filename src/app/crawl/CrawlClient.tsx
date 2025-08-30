'use client';
import { useState } from 'react';

export default function CrawlClient() {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [jur, setJur] = useState('AU');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    setLoading(true);
    try {
      const r = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, url, jurisdiction: jur, type: 'generic' })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed to crawl');
      setMsg(`Ingested ✓ — ${j.chunks} chunks for “${name}”.`);
      setName(''); setUrl('');
    } catch (e:any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Add Source</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" placeholder="Source name"
               value={name} onChange={e=>setName(e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" placeholder="URL to crawl (https://…)"
               type="url" value={url} onChange={e=>setUrl(e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" placeholder="Jurisdiction (e.g., AU, NSW, VIC)"
               value={jur} onChange={e=>setJur(e.target.value)} />
        <button type="submit" className="px-4 py-2 rounded bg-zinc-900 text-white disabled:opacity-60"
                disabled={loading}>
          {loading ? 'Crawling…' : 'Crawl'}
        </button>
      </form>

      {msg && <div className="border border-green-300 bg-green-50 text-green-800 px-4 py-3 rounded">{msg}</div>}
      {err && <div className="border border-red-300 bg-red-50 text-red-800 px-4 py-3 rounded">{err}</div>}
      <div className="text-sm text-zinc-600">
        Tip: Some gov sites block bots (403/406/451). We auto-fallback to a text mirror.
      </div>
    </main>
  );
}
