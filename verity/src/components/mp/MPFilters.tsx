"use client";

'use client';
export type MPFilterState = { q:string; party:string[]; chamber:('House'|'Senate')[]; minAttendance?:number; };

export function MPFilters({ value, onChange }: { value: MPFilterState; onChange:(v:MPFilterState)=>void }) {
  const set = (p: Partial<MPFilterState>) => onChange({ ...value, ...p });
  const toggleArr = <T,>(arr:T[], item:T) => (arr.includes(item) ? arr.filter(x=>x!==item) : [...arr, item]);

  return (
    <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-sm font-semibold">Filters</div>
      <label className="mt-3 block text-sm text-neutral-100">Search
        <input value={value.q} onChange={e=>set({ q:e.target.value })}
               placeholder="Search MPs, electorates, parties…"
               className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100" />
      </label>
      <div className="mt-3 text-sm text-neutral-100">Party</div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {['Labor','Liberal','National','Greens','Independent'].map(p=>(
          <button key={p} onClick={()=>set({ party: toggleArr(value.party,p) })}
                  className={`rounded-full border px-2.5 py-1 ${value.party.includes(p)?'border-emerald-700/60 bg-emerald-900/20 text-emerald-200':'border-zinc-700 bg-zinc-900 text-neutral-100'}`}>{p}</button>
        ))}
      </div>
      <div className="mt-3 text-sm text-neutral-100">Chamber</div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {(['House','Senate'] as const).map(c=>(
          <button key={c} onClick={()=>set({ chamber: toggleArr(value.chamber,c) })}
                  className={`rounded-full border px-2.5 py-1 ${value.chamber.includes(c)?'border-emerald-700/60 bg-emerald-900/20 text-emerald-200':'border-zinc-700 bg-zinc-900 text-neutral-100'}`}>{c}</button>
        ))}
      </div>
      <label className="mt-3 block text-sm text-neutral-100">Minimum attendance
        <input type="range" min="0" max="100" value={value.minAttendance ?? 0}
               onChange={e=>set({ minAttendance:Number(e.target.value) })}
               className="mt-2 w-full accent-emerald-400" />
      </label>
    </aside>
  );
}
