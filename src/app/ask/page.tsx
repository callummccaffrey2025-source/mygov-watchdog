'use client';
import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
const TAGS = ["Federal","NSW","VIC","QLD","WA","SA","TAS","ACT","NT"];
export default function Ask() {
  const [q,setQ] = useState("");
  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/70">
          <span className="inline-block size-1.5 rounded-full bg-emerald-400" /> Ask Verity
        </span>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em]">
          Ask a question. Get a <span className="italic">verifiable</span> answer.
        </h1>
        <p className="text-white/70 max-w-2xl">
          Search across bills, Hansard, media releases, budget papers, and more. Every answer links to the exact page and clause.
        </p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2 rounded-xl bg-black px-3">
            <Search size={18} className="text-white/60"/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask about policies, votes, media releases, budgets…" className="flex-1 bg-transparent py-3 outline-none placeholder:text-white/40"/>
            <button onClick={()=>window.location.href=`/search?q=${encodeURIComponent(q)}`} className="ml-2 rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90">Ask</button>
          </div>
          <div className="mt-3 text-xs text-white/50">Try: “What changed in the 2024–25 Federal Budget for HECS indexation?”</div>
          <div className="mt-3 flex flex-wrap gap-2">{TAGS.map(t=><button key={t} onClick={()=>setQ(q?`${q} ${t}`:t)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/5">{t}</button>)}</div>
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6">
        <div className="mb-3 text-sm text-white/60">verity.run/ask</div>
        <div className="rounded-xl border border-white/10 p-4 space-y-4 bg-black">
          <label className="text-sm font-medium">Question</label>
          <div className="flex gap-2">
            <input defaultValue="What changed in the 2024–25 Federal Budget?" className="flex-1 rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"/>
            <button className="rounded-md bg-white text-black px-4 py-2 text-sm">Search</button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-white/70"><span className="rounded-full bg-white/5 px-2 py-1">Commonwealth</span><span className="rounded-full bg.white/5 px-2 py-1">Treasury</span><span className="rounded-full bg-white/5 px-2 py-1">Media releases, Budget</span></div>
          <div className="space-y-2 text-sm">
            <div>Answer: Key changes include Stage 3 adjustments, HECS indexation relief, and energy bill credits. See citations.</div>
            {["Budget Paper No.2  · p.17","Treasurer media release  · 13 May 2025","ATO guidance · Indexation 2025"].map((c,i)=>(
              <div key={i} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
                <span>{c}</span><a className="text-white/80 hover:text-white flex items-center gap-1" href="#">Open <ArrowRight size={16}/></a>
              </div>
            ))}
            <div className="text-xs text-white/50">Generated with line-level citations — always verify before publishing.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
