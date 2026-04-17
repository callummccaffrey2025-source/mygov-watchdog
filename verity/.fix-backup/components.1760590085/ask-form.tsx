"use client";
import { useState } from "react";
export default function AskForm() {
  const [q, setQ] = useState(""); const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{answer:string; citations:{title:string;url:string}[]}|null>(null);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setRes(null);
    const r = await fetch("/api/ask", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ q }) });
    const j = await r.json(); setRes(j); setLoading(false);
  }
  return (
    <div className="max-w-2xl">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2"
               value={q} onChange={e=>setQ(e.target.value)}
               placeholder='e.g. "What’s in the privacy bill?"' />
        <button className="btn-primary" disabled={!q || loading}>{loading?"Asking…":"Ask"}</button>
      </form>
      {res && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-neutral-100">{res.answer}</div>
          {res.citations?.length>0 && (
            <ul className="mt-3 list-disc pl-5 text-sm text-neutral-100">
              {res.citations.map(c=>(<li key={c.url}><a className="underline" href={c.url}>{c.title}</a></li>))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
