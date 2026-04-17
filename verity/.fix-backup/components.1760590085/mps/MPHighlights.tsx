"use client";
import { useEffect, useState } from "react";
import type { MPHighlights } from "@/types/highlights.schema";

export default function MPHighlights({ slug }: { slug: string }) {
  const [data, setData] = useState<MPHighlights|null>(null);
  useEffect(()=>{ fetch(`/api/mps/${slug}/highlights`).then(r=>r.json()).then(setData).catch(()=>{}); }, [slug]);
  if (!data) return <div className="h-16 animate-pulse rounded bg-white/10" />;
  return (
    <ul className="space-y-2">
      {data.items.map((i,idx)=>(
        <li key={idx} className={`rounded-lg px-3 py-2 text-sm ${
          i.kind==="good" ? "bg-emerald-500/10 text-emerald-200" :
          i.kind==="warn" ? "bg-amber-500/10 text-amber-200" : "bg-white/10 text-white/80"
        }`}>• {i.text}</li>
      ))}
    </ul>
  );
}
