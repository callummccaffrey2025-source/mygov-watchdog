'use client';
import { useEffect, useState } from 'react';
export default function AnnouncementBar() {
  const KEY = 'verity_announce_closed_v1';
  const [open,setOpen] = useState(false);
  useEffect(()=>{ if (!localStorage.getItem(KEY)) setOpen(true); },[]);
  if (!open) return null;
  return (
    <div className="sticky top-0 z-40 w-full border-b border-emerald-800/30 bg-emerald-900/10 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-sm text-emerald-300">
        <span>New: Bias bars v2 + Bill diff viewer now live → <a href="/changelog" className="underline">See changelog</a></span>
        <button onClick={()=>{localStorage.setItem(KEY,'1'); setOpen(false);}} className="rounded px-2 py-1 hover:bg-emerald-800/20">✕</button>
      </div>
    </div>
  );
}
