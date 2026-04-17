"use client";
import { useEffect, useState } from "react";
export default function OwnershipTable(){
  const [rows,setRows]=useState<{outlet:string;parent:string}[]>([]);
  const [sel,setSel]=useState<{outlet:string;parent:string}|null>(null);
  useEffect(()=>{fetch("/data/ownership.json").then(r=>r.json()).then(d=>setRows(d.rows||[])).catch(()=>setRows([]));},[]);
  return (<div>
    <table className="w-full text-sm">
      <thead className="text-neutral-100"><tr><th className="text-left p-2">Outlet</th><th className="text-left p-2">Parent</th></tr></thead>
      <tbody className="text-neutral-100">
        {rows.map((r,i)=><tr key={i} className="border-t border-zinc-800 hover:bg-zinc-900/30 cursor-pointer" onClick={()=>setSel(r)}><td className="p-2">{r.outlet}</td><td className="p-2">{r.parent}</td></tr>)}
      </tbody>
    </table>
    {sel && <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={()=>setSel(null)}>
      <div className="card p-5 max-w-lg" onClick={e=>e.stopPropagation()}>
        <div className="font-semibold">Ownership</div>
        <div className="mt-2 text-sm text-neutral-100"><b>{sel.outlet}</b> → {sel.parent}</div>
        <button className="btn mt-4" onClick={()=>setSel(null)}>Close</button>
      </div>
    </div>}
  </div>);
}
