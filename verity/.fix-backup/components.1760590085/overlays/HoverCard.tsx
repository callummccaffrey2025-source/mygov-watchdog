"use client";
import { useEffect, useRef, useState } from "react";

export default function HoverCard({
  anchorId, children, offset = 10,
}: { anchorId: string; children: React.ReactNode; offset?: number }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{top:number,left:number}>({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const a = document.getElementById(anchorId);
    if (!a) return;
    let tm: any;
    const show = () => {
      const r = a.getBoundingClientRect();
      setPos({ top: r.bottom + offset + window.scrollY, left: Math.min(Math.max(12, r.left + window.scrollX), window.scrollX + window.innerWidth - 340) });
      tm = setTimeout(() => setOpen(true), 80);
    };
    const hide = () => { clearTimeout(tm); setOpen(false); };
    a.addEventListener("mouseenter", show);
    a.addEventListener("mouseleave", hide);
    a.addEventListener("focus", show);
    a.addEventListener("blur", hide);
    return () => { a.removeEventListener("mouseenter", show); a.removeEventListener("mouseleave", hide); a.removeEventListener("focus", show); a.removeEventListener("blur", hide); };
  }, [anchorId, offset]);

  return open ? (
    <div
      ref={ref}
      style={{ top: pos.top, left: pos.left, width: 328 }}
      className="absolute z-[60] rounded-xl border border-white/12 bg-black/85 p-3 text-sm shadow-2xl backdrop-blur"
      role="dialog" aria-modal="false"
    >
      {children}
    </div>
  ) : null;
}
