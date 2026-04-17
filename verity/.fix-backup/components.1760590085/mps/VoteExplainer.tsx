"use client";
import { useEffect, useState } from "react";
import type { VoteExplainer } from "@/types/vote-explainer.schema";

export default function VoteExplainer({ billId }: { billId: string }) {
  const [data, setData] = useState<VoteExplainer | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    fetch(`/api/bills/${billId}/summary`).then(r => r.json()).then(setData).catch(()=>{});
  }, [open, billId, data]);

  return (
    <div className="mt-2">
      <button className="text-xs underline decoration-white/20 underline-offset-2 hover:decoration-white" onClick={() => setOpen(!open)}>
        {open ? "Hide" : "Why this matters"}
      </button>
      {open && data && (
        <div className="mt-2 rounded-lg border border-white/10 p-3">
          <ul className="space-y-2">
            {data.bullets.map((b, i) => (
              <li key={i} className="text-sm">
                • {b.text}
                <span className="ml-2 space-x-2 text-xs">
                  {b.sources.map((s, j) => (
                    <a key={j} className="underline decoration-white/20 hover:decoration-white" href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-right text-[11px] text-white/50">Confidence: {data.confidence}</div>
        </div>
      )}
    </div>
  );
}
