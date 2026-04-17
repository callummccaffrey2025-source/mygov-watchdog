'use client';
import { useState } from 'react';
import Section from '@/components/shared/Section';
import Empty from '@/components/shared/Empty';

export default function Page(){
  const [q,setQ] = useState(''); const [data,setData] = useState<any>(null);
  const run = async () => {
    const r = await fetch('/api/search?q=' + encodeURIComponent(q));
    setData(await r.json());
  };
  return (
    <Section title="Search">
      <div className="flex gap-2 mb-4">
        <input
          value={q} onChange={e=>setQ(e.target.value)}
          placeholder="Search bills, MPs, parties, topics…"
          className="flex-1 rounded-2xl px-4 py-2 bg-black/30 border border-white/10"
        />
        <button className="btn" onClick={run}>Search</button>
      </div>
      {!data && <Empty title="Try a search" />}
      {data && (data.results?.length ?? 0) === 0 && <Empty title={`No results for “${data.q}”`} />}
      {data && (data.results?.length ?? 0) > 0 && (
        <div className="space-y-6">
          {data.results.map((group:any)=>(
            <div key={group.type} className="space-y-3">
              <div className="text-sm font-semibold uppercase tracking-wide subtle">{group.type}</div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map((it:any)=>(
                  <div key={it.id} className="card p-4">{it.title || it.name}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
