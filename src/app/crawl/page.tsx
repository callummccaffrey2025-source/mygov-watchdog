'use client';
import { useState } from 'react';

async function addSource(payload: { name: string; url: string; jurisdiction: string; type?: string }) {
  const res = await fetch('/api/crawl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const text = await res.text();
  const data = isJson && text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (data && data.error) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (!data || !data.id) throw new Error('Unexpected API response (missing id)');
  return data;
}

export default function CrawlPage() {
  const [name, setName] = useState('OAIC - Newsroom');
  const [url, setUrl] = useState('https://www.oaic.gov.au/newsroom');
  const [jur, setJur] = useState('AU');
  const [msg, setMsg] = useState<string|null>(null);
  const [err, setErr] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    try {
      // 1) Ask server if this URL is blocked; get a mirror if needed
      const checkRes = await fetch('/api/check-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const check = await checkRes.json();
      let finalUrl = url;
      if (check?.mirror && check?.ok === false) {
        finalUrl = check.mirror as string;
        setMsg('Site blocks datacenter IPs — using a mirror automatically.');
      }

      // 2) Save the source (with original or mirrored URL as needed)
      const payload = { name, url: finalUrl, jurisdiction: jur.trim().toUpperCase(), type: undefined as string | undefined };
      const saved = await addSource(payload);

      setMsg(`Saved ✓  (id: ${saved.id})`);
    } catch (e:any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl py-10">
      <h1 className="text-2xl font-semibold">Add Source</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input className="w-full rounded border px-3 py-2" value={name} onChange={e=>setName(e.target.value)} placeholder="Name" />
        <input className="w-full rounded border px-3 py-2" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." />
        <input className="w-full rounded border px-3 py-2" value={jur} onChange={e=>setJur(e.target.value)} placeholder="AU / NSW / VIC ..." />
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">{loading ? 'Saving…' : 'Crawl'}</button>
      </form>
      {msg && <p className="mt-4 text-sm text-green-700">{msg}</p>}
      {err && <p className="mt-4 text-sm text-red-600">Error: {err}</p>}
      <p className="mt-6 text-sm text-gray-500">Tip: government sites often block cloud IPs. We’ll try a clean mirror automatically.</p>
    </main>
  );
}
