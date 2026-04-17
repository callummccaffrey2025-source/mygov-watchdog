"use client";
import { useEffect, useState } from "react";

export default function MobileSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const btn = document.querySelector('[data-mobile-nav]');
    if (!btn) return;
    const onClick = () => setOpen(true);
    btn.addEventListener('click', onClick);
    return () => btn.removeEventListener('click', onClick);
  }, []);

  const close = () => setOpen(false);
  if (!open) return null;

  const Item = ({ href, label }: { href: string; label: string }) => (
    <a href={href} className="block rounded-xl bg-white/5 px-4 py-4 text-center text-base hover:bg-white/10" onClick={close}>{label}</a>
  );

  return (
    <div className="fixed inset-0 z-[95] bg-black/60" onClick={close} role="dialog" aria-modal="true">
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-white/12 bg-black/90 p-4 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="grid grid-cols-2 gap-3">
          <Item href="/" label="Home" />
          <Item href="/mps" label="MPs" />
          <Item href="/bills" label="Bills" />
          <Item href="/news" label="News" />
          <Item href="/pricing" label="Pricing" />
          <Item href="/join" label="Join" />
        </div>
        <button onClick={close} className="mt-4 w-full rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15">Close</button>
      </div>
    </div>
  );
}
