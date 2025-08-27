'use client';
import { useState } from 'react';

export default function Search() {
  const [q,setQ]=useState('');
  const [loading,setL]=useState(false);
  const [results,setR]=useState<any[]>([]);
  const [jur,setJur]=useState('');

  async function go(){
    setL(true);
    const params = new URLSearchParams({ q, ...(jur?{jurisdiction:jur}:{}) });
    const res = await fetch('/api/search?'+params.toString());
    const j = await res.json();
    setR(j.results || []);
    setL(false);
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Semantic Search</h1>
      <div className="flex gap-2">
        <input className="border rounded-lg px-3 py-2 w-full" placeholder="e.g., safeguard mechanism changes" value={q} onChange={e=>setQ(e.target.value)} />
        <input className="border rounded-lg px-3 py-2 w-40" placeholder="jurisdiction (optional)" value={jur} onChange={e=>setJur(e.target.value)} />
        <button onClick={go} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{loading?'Searching…':'Search'}</button>
      </div>
      <div className="grid gap-3">
        {results.map((d:any)=>(
          <a key={d.id} href={d.url || '#'} target="_blank" className="block rounded-lg border bg-white p-4 hover:shadow">
            <div className="font-medium">{d.title}</div>
            {d.url && <div className="text-sm text-slate-500 truncate">{d.url}</div>}
            <div className="text-xs text-slate-400">{new Date(d.created_at).toLocaleString()}</div>
          </a>
        ))}
        {(!results || results.length===0) && <div className="text-slate-500">No results yet. Add a source first in <a className="underline" href="/crawl">/crawl</a>.</div>}
      </div>
    </main>
  );
}
