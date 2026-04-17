
"use client";
import { useEffect, useMemo, useState } from "react";
type BriefItem =
 | { kind:"topic"; topic:string; title:string; url:string; date?:string }
 | { kind:"bill";  id:string; title:string; stage:string; last_updated?:string }
 | { kind:"mp";    id:string; name:string;  party?:string; electorate?:string };
type Alerts={topics?:string[]; mpIds?:string[]; billIds?:string[]};
const b64=(o: unknown)=>{ try{ return typeof window==="undefined"?"":window.btoa(unescape(encodeURIComponent(JSON.stringify(o)))); } catch { return ""; } };

export default function AlertsBriefingsSection(){
  const [topic,setTopic]=useState(""), [alerts,setAlerts]=useState<Alerts>(()=>{ try{ return JSON.parse(localStorage.getItem("verity.alerts")||"{}"); }catch{return{}}; });
  const [items,setItems]=useState<BriefItem[]>([]);
  const hasAny=useMemo(()=> (alerts.topics?.length||alerts.billIds?.length||alerts.mpIds?.length),[alerts]);
  function persist(next:Alerts){ setAlerts(next); localStorage.setItem("verity.alerts", JSON.stringify(next)); }
  async function refresh(){ const qs=hasAny?`?alerts=${b64(alerts)}`:""; const j=await (await fetch("/api/briefings"+qs)).json(); setItems(j.items||[]); }
  useEffect(()=>{ refresh();   },[]);
  useEffect(()=>{ refresh();   },[JSON.stringify(alerts)]);
  function addTopic(e:React.FormEvent){ e.preventDefault(); const t=topic.trim(); if(!t) return; setTopic(""); persist({ ...alerts, topics:Array.from(new Set([...(alerts.topics||[]), t]))}); }
  function removeTopic(t:string){ persist({ ...alerts, topics:(alerts.topics||[]).filter(x=>x!==t) }); }
  return (<div>
    <form onSubmit={addTopic} className="flex gap-2">
      <input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Add topic: housing, transparency…"
             className="w-full rounded-md bg-black/40 border border-neutral-700 px-3 py-2 text-sm focus:border-emerald-500"/>
      <button className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500">Add</button>
    </form>
    {!!alerts.topics?.length && <div className="mt-2 flex flex-wrap gap-2">
      {alerts.topics.map(t=><button key={t} onClick={()=>removeTopic(t)} className="rounded-full border border-neutral-700 px-2 py-1 text-xs hover:border-emerald-500">{t} ×</button>)}
    </div>}
    <div className="mt-3 max-h-64 overflow-auto space-y-2">
      {items.map((it,i)=> it.kind==="topic" ? (
        <a key={i} href={it.url} target="_blank" rel="noreferrer" className="block rounded border border-neutral-800 p-2 hover:border-emerald-600">
          <div className="text-xs text-emerald-300">Topic: {it.topic}</div><div className="text-sm">{it.title}</div></a>)
        : it.kind==="bill" ? (
        <a key={i} href={`/bills/${it.id}`} className="block rounded border border-neutral-800 p-2 hover:border-emerald-600">
          <div className="text-xs text-emerald-300">Bill</div><div className="text-sm">{it.title}</div></a>)
        : (
        <a key={i} href={`/mps/${it.id}`} className="block rounded border border-neutral-800 p-2 hover:border-emerald-600">
          <div className="text-xs text-emerald-300">MP</div><div className="text-sm">{it.name}</div></a>)
      )}
    </div></div>);
}
