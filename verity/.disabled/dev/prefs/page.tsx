'use client';
import { useEffect, useState } from "react";
import { getPrefs, setPrefs, prefs as actions, type Prefs } from "@/lib/prefs";

export default function Page(){
  const [p,setP]=useState<Prefs>({mps:[],bills:[],topics:[]});
  useEffect(()=>{ setP(getPrefs()); },[]);
  const update=(next: Prefs)=>{ setPrefs(next); setP(getPrefs()); };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dev · Prefs</h1>
      <div className="mt-4 space-y-4">
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-300">MPs</h2>
          <input className="mt-2 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm"
                 placeholder="comma-separated ids e.g. mp-123,mp-456"
                 value={p.mps.join(',')}
                 onChange={e=>update({...p, mps:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-300">Bills</h2>
          <input className="mt-2 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm"
                 placeholder="comma-separated ids e.g. bill-1,bill-2"
                 value={p.bills.join(',')}
                 onChange={e=>update({...p, bills:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-300">Topics</h2>
          <input className="mt-2 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm"
                 placeholder="comma-separated topics"
                 value={p.topics.join(',')}
                 onChange={e=>update({...p, topics:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-2xl border border-zinc-800 px-3 py-1.5 hover:border-zinc-700" onClick={()=>{ actions.followMP('mp-demo'); setP(getPrefs()); }}>+ Follow MP demo</button>
          <button className="rounded-2xl border border-zinc-800 px-3 py-1.5 hover:border-zinc-700" onClick={()=>{ actions.followBill('bill-demo'); setP(getPrefs()); }}>+ Follow bill demo</button>
          <button className="rounded-2xl border border-zinc-800 px-3 py-1.5 hover:border-zinc-700" onClick={()=>{ actions.toggleTopic('Immigration', true); setP(getPrefs()); }}>+ Topic “Immigration”</button>
          <button className="rounded-2xl border border-rose-700 px-3 py-1.5 hover:border-rose-600" onClick={()=>{ setPrefs({mps:[],bills:[],topics:[]}); setP(getPrefs()); }}>Reset</button>
        </div>
      </div>
    </main>
  );
}
