"use client";
import { useEffect, useState } from "react";
const ALL = ["Privacy", "AI", "Health", "Education", "Energy"];
export default function AlertsClient() {
  const [email, setEmail] = useState(""); const [topics, setTopics] = useState<string[]>([]);
  const [ok, setOk] = useState<boolean|null>(null);
  useEffect(()=>{ try{const s=localStorage.getItem("alerts_prefs"); if(s){const j=JSON.parse(s); setEmail(j.email||""); setTopics(j.topics||[]);} }catch{} },[]);
  useEffect(()=>{ localStorage.setItem("alerts_prefs", JSON.stringify({ email, topics })); },[email,topics]);
  async function save(e: React.FormEvent){ e.preventDefault(); const r=await fetch("/api/alerts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,topics})}); setOk(r.ok); }
  const toggle=(t:string)=>setTopics(v=>v.includes(t)?v.filter(x=>x!==t):[...v,t]);
  return (
    <form onSubmit={save} className="max-w-xl space-y-4">
      <div><label className="text-sm text-neutral-100">Email</label>
        <input className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2" type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
      <div><div className="text-sm text-neutral-100">Topics</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALL.map(t=>(
            <button key={t} type="button" onClick={()=>toggle(t)}
              className={`rounded-full border px-3 py-1 text-sm ${topics.includes(t)?"border-emerald-400/40 bg-emerald-400/10":"border-white/10 bg-white/5"}`}>{t}</button>
          ))}
        </div></div>
      <button className="btn-primary">Save preferences</button>
      {ok===true && <div className="text-emerald-400 text-sm">Saved. You’ll get daily summaries.</div>}
      {ok===false && <div className="text-red-400 text-sm">Couldn’t save. Try again.</div>}
    </form>
  );
}
