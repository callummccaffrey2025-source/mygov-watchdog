
"use client";
import { useState } from "react";
type Hit = { sourceId:string; title:string; url:string; snippet:string };

export default function SearchSection(){
  const [q,setQ]=useState(""), [hits,setHits]=useState<Hit[]>([]), [loading,setLoading]=useState(false);
  async function run(e:React.FormEvent){ e.preventDefault(); setLoading(true);
    try { const r=await fetch(`/api/search?q=${encodeURIComponent(q)}`); const j=await r.json(); setHits(j.hits||[]); }
    finally { setLoading(false); }
  }
  return (<div>
    <form onSubmit={run} className="flex gap-2">
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Try: housing, whistleblower…"
             className="w-full rounded-md bg-black/40 border border-neutral-700 px-3 py-2 text-sm focus:border-emerald-500"/>
      <button className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500" disabled={loading}>
        {loading?"Searching…":"Search"}</button>
    </form>
    <div className="mt-3 space-y-2">
      {loading && <div className="h-20 animate-pulse rounded bg-neutral-800" />}
      {hits.map(h=>(
        <a key={h.sourceId} href={h.url} target="_blank" rel="noreferrer"
           className="block rounded border border-neutral-800 p-2 hover:border-emerald-600">
          <div className="text-sm font-medium">{h.title}</div>
          <div className="text-xs text-neutral-100">{h.snippet}</div>
        </a>
      ))}
    </div></div>);
}
