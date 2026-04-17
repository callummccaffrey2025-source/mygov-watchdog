
"use client";
import { useState } from "react";
type Citation = { sourceId: string; url: string; title: string; snippet: string };

export default function AskSection() {
  const [q,setQ]=useState(""), [loading,setLoading]=useState(false);
  const [answer,setAnswer]=useState(""), [cites,setCites]=useState<Citation[]>([]);
  async function onAsk(e: React.FormEvent){ e.preventDefault(); if(!q.trim()) return;
    setLoading(true);
    try {
      const r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({q})});
      const j=await r.json(); setAnswer(j.answer||""); setCites(j.citations||[]);
    } finally { setLoading(false); }
  }
  return (<div>
    <form onSubmit={onAsk} className="flex gap-2">
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="What changed in the budget?"
             className="w-full rounded-md bg-black/40 border border-neutral-700 px-3 py-2 text-sm focus:border-emerald-500"/>
      <button className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500" disabled={loading}>
        {loading?"Asking…":"Ask"}</button>
    </form>
    <div className="mt-3 space-y-3" aria-live="polite">
      {loading && <div className="h-20 animate-pulse rounded bg-neutral-800" />}
      {!!answer && <p className="text-sm whitespace-pre-wrap">{answer}</p>}
      {!!cites.length && <ol className="list-decimal pl-5 space-y-1">
        {cites.map(c=><li key={c.sourceId} className="text-xs text-neutral-100">
          <a className="underline" href={c.url} target="_blank" rel="noreferrer">{c.title}</a> — <span className="text-neutral-500">{c.snippet}</span>
        </li>)}
      </ol>}
    </div></div>);
}
