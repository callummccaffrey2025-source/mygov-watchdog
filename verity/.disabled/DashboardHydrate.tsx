'use client';
import { useEffect, useState } from "react";
import DashboardEmpty from "@/components/DashboardEmpty";
import { getPrefs, type Prefs } from "@/lib/prefs";

export default function DashboardHydrate(){
  const [p, setP] = useState<Prefs | null>(null);
  useEffect(()=>{ setP(getPrefs()); }, []);

  // Initial paint -> skeleton to avoid jump
  if (p === null) {
    return (
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({length:6}).map((_,i)=><div key={i} className="card h-20 animate-pulse" />)}
      </div>
    );
  }

  const hasAny = (p.mps?.length||0) + (p.bills?.length||0) + (p.topics?.length||0) > 0;
  if (!hasAny) return <DashboardEmpty />;

  return (
    <>
      <section className="mt-8">
        <h2 className="text-sm font-medium text-zinc-300">Your MPs</h2>
        {p.mps?.length ? (
          <div className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {p.mps.map(id=>(
              <a key={id} href={`/mps/${id}`} className="card p-4 block" aria-label={`View profile for ${id}`}>
                <div className="font-medium">{id}</div>
                <div className="text-xs text-zinc-400">Following</div>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-2 card p-4 text-sm text-zinc-400">You’re not following any MPs yet.</div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-zinc-300">Bills you follow</h2>
        {p.bills?.length ? (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {p.bills.map(id=>(
              <a key={id} href={`/bills/${id}`} className="card p-4 block" aria-label={`Open bill ${id}`}>
                <div className="font-medium">{id}</div>
                <div className="text-xs text-zinc-400">Following</div>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-2 card p-4 text-sm text-zinc-400">You’re not following any bills yet.</div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-zinc-300">Topics</h2>
        {p.topics?.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {p.topics.map(t=>(
              <span key={t} className="px-3 py-1 rounded-full border border-zinc-800 text-xs">{t}</span>
            ))}
          </div>
        ) : (
          <div className="mt-2 card p-4 text-sm text-zinc-400">Pick a few topics to personalize your news.</div>
        )}
      </section>
    </>
  );
}
