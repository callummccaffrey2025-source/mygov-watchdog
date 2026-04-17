"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";

type Entry = { label: string; href: string; hint?: string };

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const metaK = (e.key.toLowerCase()==="k" && (e.metaKey || e.ctrlKey));
      const slash = (e.key==="/" && !e.metaKey && !e.ctrlKey);
      if (metaK || slash) { e.preventDefault(); setOpen(true); track("cmd_open"); }
      if (e.key==="Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) setTimeout(()=> inputRef.current?.focus(), 0); }, [open]);

  const base: Entry[] = useMemo(()=>[
    { label: "MPs", href: "/mps", hint: "Browse MPs" },
    { label: "Bills", href: "/bills", hint: "Browse bills" },
    { label: "News", href: "/news" },
  ], []);

  const go = (href:string)=>{ track("cmd_go",{href,q}); setOpen(false); window.location.href=href; };

  const results = useMemo(()=>{
    const k = q.trim().toLowerCase();
    if (!k) return base;
    // client-side quick filter for known sections; deeper search goes to /search?q=
    return base.filter(e => e.label.toLowerCase().includes(k));
  }, [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" onClick={()=>setOpen(false)} aria-modal="true" role="dialog">
      <div className="mx-auto mt-24 w-full max-w-xl rounded-xl border border-white/15 bg-black/90 p-3 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)}
          placeholder="Search MPs, bills, keywords… (Enter to search)"
          className="mb-2 w-full rounded-lg bg-black/30 px-3 py-2 outline-none ring-1 ring-white/10 focus:ring-white/25" />
        <div className="max-h-72 overflow-auto">
          {results.map((r)=>(
            <button key={r.href} onClick={()=>go(r.href)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-white/5">
              <span>{r.label}</span>
              {r.hint ? <span className="text-xs text-white/60">{r.hint}</span> : null}
            </button>
          ))}
          <button onClick={()=>go(`/search?q=${encodeURIComponent(q)}`)} className="mt-2 w-full rounded-lg bg-white/10 px-3 py-2 text-left hover:bg-white/15">
            Search “{q || '…'}”
          </button>
        </div>
      </div>
    </div>
  );
}
