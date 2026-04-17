"use client";
import { useEffect, useId, useState } from "react";
import HoverCard from "@/components/overlays/HoverCard";

type Bill = { id: string; title: string; summary?: string; introduced_at?: string; stage?: string };

export default function BillHoverCard({ billId, anchorId }: { billId: string; anchorId: string }) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [loaded, setLoaded] = useState(false);
  const hid = useId();

  useEffect(() => {
    if (loaded) return;
    const a = document.getElementById(anchorId);
    if (!a) return;
    const preload = async () => {
      if (loaded) return;
      try {
        // Try a real API if present, otherwise fallback to minimal data from the table row.
        const res = await fetch(`/api/bills/${billId}`).catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          setBill({ id: billId, title: data.title ?? "", summary: data.summary ?? "", introduced_at: data.introduced_at, stage: data.stage });
        } else {
          setBill({ id: billId, title: a.textContent ?? "", stage: (a.closest("tr")?.querySelector("td:nth-child(2)") as HTMLElement)?.innerText });
        }
      } catch {}
      setLoaded(true);
    };
    a.addEventListener("mouseenter", preload, { once: true });
    a.addEventListener("focus", preload, { once: true });
    return () => {};
  }, [anchorId, billId, loaded]);

  return (
    <HoverCard anchorId={anchorId} offset={8}>
      {!bill ? (
        <div className="h-16 animate-pulse rounded bg-white/10" />
      ) : (
        <div className="space-y-2">
          <div className="font-medium">{bill.title}</div>
          {bill.stage ? <div className="text-xs text-white/70">Stage: {bill.stage}</div> : null}
          {bill.introduced_at ? <div className="text-xs text-white/70">Introduced: {new Date(bill.introduced_at).toLocaleDateString()}</div> : null}
          {bill.summary ? <p className="text-white/80 line-clamp-3">{bill.summary}</p> : null}
          <div className="text-xs">
            <a className="underline decoration-white/20 underline-offset-2 hover:decoration-white" href={`/bills/${bill.id}`}>Open bill →</a>
          </div>
        </div>
      )}
    </HoverCard>
  );
}
