"use client";
import { useState } from "react";
const ISSUES=["Housing","Climate","Economy","Energy","Justice","Education","Health"];
export default function Onboarding(){
  const [sel,setSel]=useState<string[]>([]);
  const toggle=(x:string)=>setSel(s=> s.includes(x)? s.filter(i=>i!==x):[...s,x]);
  return(<div><h1 className="font-extrabold">Welcome</h1><p className="mt-2 text-neutral-100">Tell us your electorate and interests to personalise your brief.</p>
    <div className="mt-4">
      <label className="block text-sm mb-2">Electorate</label>
      <input className="input w-full max-w-sm" placeholder="e.g. Sydney"/>
    </div>
    <div className="mt-4">
      <div className="text-sm mb-2">Issues</div>
      <div className="flex flex-wrap gap-2">{ISSUES.map(i=><button key={i} className={"px-3 py-1.5 rounded-full border "+(sel.includes(i)?"border-emerald-700/70 text-emerald-300 bg-emerald-900/20":"border-zinc-800 bg-zinc-900/30 text-neutral-100")} onClick={()=>toggle(i)}>{i}</button>)}</div>
    </div>
    <button className="btn mt-6">Create my feed</button>
  </div>);
}
