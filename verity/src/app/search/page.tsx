/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";
import { useState } from "react";
export default function SearchPage() {
  const [q,setQ]=useState("");
  const [results,setResults]=useState<any[]>([]);
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-3xl font-semibold">Search</h1>
      <div className="flex gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} className="flex-1 border rounded-lg p-3" placeholder="Search bills, debates, news..." />
        <button className="rounded-lg px-4 py-2 border" onClick={async()=>{
          const r = await fetch("/api/search?q="+encodeURIComponent(q)); setResults(await r.json());
        }}>Search</button>
      </div>
      <ul className="space-y-3">
        {results.map(r=>(
          <li key={r.id} className="border rounded-lg p-3">
            <a className="font-medium underline" href={r.url} target="_blank">{r.title}</a>
            <div className="text-sm opacity-70">{new Date(r.published_at).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
