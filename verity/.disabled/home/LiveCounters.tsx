"use client";
import { useEffect, useState } from "react";

export default function LiveCounters({ initial }: { initial: { bills: number; mps: number } }) {
  const [bills, setBills] = useState(initial.bills);
  const [mps, setMps] = useState(initial.mps);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/counters", { cache: "no-store" });
        const j = await r.json();
        if (active && j?.ok) {
          if (typeof j.bills === "number") setBills(j.bills);
          if (typeof j.mps === "number") setMps(j.mps);
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  return <div className="sr-only" data-bills={bills} data-mps={mps} aria-hidden="true" />;
}
