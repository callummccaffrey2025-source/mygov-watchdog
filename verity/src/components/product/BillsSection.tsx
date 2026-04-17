"use client";


"use client";
import { useEffect, useState } from "react";
type Bill={id:string; title:string; stage:string; last_updated?:string};

export default function BillsSection(){
  const [rows,setRows]=useState<Bill[]>([]), [sort,setSort]=useState<"date"|"stage">("date");
  useEffect(()=>{(async()=>{const r=await fetch("/api/bills"); setRows(await r.json());})()},[]);
  const sorted=[...rows].sort((a,b)=> sort==="stage" ? (a.stage||"").localeCompare(b.stage||"")
    : (Date.parse(b.last_updated||"0")-Date.parse(a.last_updated||"0")));
  return (<div>
    <div className="mb-2 flex items-center gap-2 text-xs">
      <span className="text-neutral-100">Sort:</span>
      <button onClick={()=>setSort("date")}  className={`px-2 py-1 rounded ${sort==="date" ?"bg-neutral-800":""}`}>Updated</button>
      <button onClick={()=>setSort("stage")} className={`px-2 py-1 rounded ${sort==="stage"?"bg-neutral-800":""}`}>Stage</button>
    </div>
    <div className="max-h-72 overflow-auto rounded border border-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-neutral-900 text-neutral-100"><tr>
          <th className="text-left p-2">Title</th><th className="text-left p-2">Stage</th><th className="text-left p-2">Updated</th>
        </tr></thead>
        <tbody>
          {sorted.map(b=>(
            <tr key={b.id} className="border-t border-neutral-900 hover:bg-neutral-900/50">
              <td className="p-2"><a className="underline" href={`/bills/${b.id}`}>{b.title}</a></td>
              <td className="p-2"><span className="rounded bg-emerald-900/30 px-2 py-0.5 text-emerald-300 text-xs">{b.stage}</span></td>
              <td className="p-2 text-neutral-100">{b.last_updated?.slice(0,10) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div></div>);
}
