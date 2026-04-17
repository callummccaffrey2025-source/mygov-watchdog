"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const link = "relative px-3 py-1.5 text-sm text-white/80 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald/60 rounded-md";
const active = "text-emerald";

export default function Nav(){
  const [open,setOpen]=useState(false);
  const pathname=usePathname();

  useEffect(()=>{ document.body.style.overflow=open?"hidden":""; },[open]);

  const L = ({href,label}:{href:string;label:string}) => (
    <a href={href} className={`${link} ${pathname===href?active:""}`} onClick={()=>setOpen(false)}>{label}
      {pathname===href && <span className="absolute inset-x-2 -bottom-[6px] h-[2px] bg-emerald/80" />}
    </a>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0f14]/80 backdrop-blur">
      <nav className="container-verity flex items-center justify-between py-3">
        <a href="/" className="text-lg font-semibold tracking-tight text-emerald">Verity</a>
        <div className="hidden items-center gap-2 md:flex">
          <L href="/mps" label="MPs" />
          <L href="/bills" label="Bills" />
          <L href="/news" label="News" />
          <L href="/pricing" label="Pricing" />
          <a href="/join" className="btn btn-primary ml-1">Join</a>
        </div>
        <button aria-expanded={open} className="md:hidden rounded-lg p-2 focus-visible:ring-2 focus-visible:ring-emerald/60" onClick={()=>setOpen(v=>!v)}>
          <span className="sr-only">Open Menu</span>
          <div className="h-5 w-6">
            <div className={`h-0.5 w-6 bg-current transition ${open?"translate-y-2 rotate-45":""}`} />
            <div className={`mt-1.5 h-0.5 w-6 bg-current transition ${open?"opacity-0":""}`} />
            <div className={`mt-1.5 h-0.5 w-6 bg-current transition ${open?"-translate-y-2 -rotate-45":""}`} />
          </div>
        </button>
      </nav>
      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#0b0f14]">
          <div className="container-verity flex flex-col gap-2 py-3">
            <L href="/mps" label="MPs" />
            <L href="/bills" label="Bills" />
            <L href="/news" label="News" />
            <L href="/pricing" label="Pricing" />
            <a href="/join" className="btn btn-primary w-max">Join</a>
          </div>
        </div>
      )}
    </header>
  );
}
