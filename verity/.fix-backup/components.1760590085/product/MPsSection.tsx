
"use client";
import { useEffect, useMemo, useState } from "react";
type MP={id:string; name:string; party?:string; electorate?:string};

export default function MPsSection(){
  const [rows,setRows]=useState<MP[]>([]), [party,setParty]=useState(""), [q,setQ]=useState("");
  useEffect(()=>{(async()=>{const r=await fetch("/api/mps"); setRows(await r.json());})()},[]);
  const parties=useMemo(()=>Array.from(new Set(rows.map(r=>r.party).filter(Boolean))) as string[],[rows]);
  const filtered=rows.filter(m=> (party?m.party===party:true) && (`${m.name} ${m.electorate} ${m.party}`.toLowerCase().includes(q.toLowerCase())));
  return (<div>
    <div className="mb-2 flex gap-2">
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search MPs"
             className="w-full rounded-md bg-black/40 border border-neutral-700 px-3 py-2 text-sm focus:border-emerald-500"/>
      <select value={party} onChange={e=>setParty(e.target.value)} className="rounded-md bg-black/40 border border-neutral-700 px-2 py-2 text-sm">
        <option value="">All parties</option>{parties.map(p=><option key={p} value={p}>{p}</option>)}
      </select>
    </div>
    <div className="max-h-72 overflow-auto divide-y divide-neutral-900 border border-neutral-800 rounded">
      {filtered.map(m=>(
        <a key={m.id} href={`/mps/${m.id}`} className="block p-2 hover:bg-neutral-900/50">
          <div className="text-sm font-medium">{m.name}</div>
          <div className="text-xs text-neutral-100">{m.party} · {m.electorate}</div>
        </a>
      ))}
    </div></div>);
}
