"use client";
import { useEffect,useMemo,useState } from "react"; import { Search } from "lucide-react";
const items=[{href:"/ground",label:"News"},{href:"/bills",label:"Bills"},{href:"/mps",label:"MPs"},{href:"/ownership",label:"Ownership"},{href:"/search",label:"Search"},{href:"/join-waitlist",label:"Join waitlist"}];
export default function CmdPalette(){
  const [open,setOpen]=useState(false); const [q,setQ]=useState("");
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setOpen(v=>!v);} if(e.key==="Escape") setOpen(false)};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[]);
  const filtered=useMemo(()=>items.filter(i=>i.label.toLowerCase().includes(q.toLowerCase())),[q]); if(!open) return null;
  return(<div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60">
    <div className="w-[560px] max-w-[95vw] rounded-xl border border-zinc-800 bg-[#0a0f14] p-3">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2"><Search size={18} className="text-zinc-500"/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Jump to…" className="flex-1 bg-transparent outline-none text-sm text-neutral-100"/><kbd className="text-xs text-zinc-500">Esc</kbd></div>
      <ul className="max-h-[50vh] overflow-auto py-2">
        {filtered.map(i=>(<li key={i.href}><a href={i.href} className="block px-3 py-2 rounded hover:bg-emerald-900/10">{i.label}</a></li>))}
        {!filtered.length&&<li className="px-3 py-2 text-sm text-zinc-500">No results</li>}
      </ul>
      <div className="flex justify-between text-[11px] text-zinc-500 px-1"><span>Type to filter</span><span>⌘K / Ctrl+K</span></div>
    </div>
  </div>);
}
