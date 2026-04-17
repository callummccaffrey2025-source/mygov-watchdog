'use client';
import { useState } from 'react';
import type { Receipt } from '../../lib/types/mp';

export function ReceiptsDrawer({ items, label='Receipts' }: { items: Receipt[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={()=>setOpen(true)} className="text-emerald-300 hover:text-emerald-200 text-sm">{label} →</button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-zinc-800 bg-zinc-950 p-4 text-zinc-100">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Receipts</div>
              <button className="text-neutral-100 hover:text-neutral-100" onClick={()=>setOpen(false)}>Close</button>
            </div>
            <ul className="mt-4 space-y-3">
              {items.map((r,i)=>(
                <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                  <div className="text-sm font-medium">{r.label}</div>
                  <div className="text-xs text-neutral-100">{r.source}{r.date?` · ${r.date}`:''}</div>
                  <a className="text-emerald-300 text-sm" href={r.url}>Open ↗</a>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
