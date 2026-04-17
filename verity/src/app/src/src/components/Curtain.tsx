"use client";
import React, { useEffect, useState } from "react";

type Props = {
  children?: React.ReactNode;
  onSub?: () => void;
};

export default function Curtain({ children, onSub }: Props) {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/subscription/status");
        const data = await res.json();
        if (data?.active) setOk(true);
      } catch {}
    })();
  }, []);

  if (ok) return <>{children}</>;

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-emerald-400/40 bg-neutral-900/70 p-6 text-center">
      <h2 className="text-2xl font-semibold">Subscribe to unlock</h2>
      <p className="mt-2 text-neutral-300 text-sm">
        Unlimited Verity for just{" "}
        <span className="text-emerald-300 font-semibold">$1/mo</span>.
      </p>
      <button
        className="mt-4 rounded-xl bg-emerald-400 text-neutral-900 px-5 py-3 font-semibold hover:bg-emerald-300"
        onClick={async () => {
          try {
            const r = await fetch("/api/subscription", { method: "POST" });
            if (!r.ok) throw new Error();
            setOk(true);
            onSub?.();
          } catch {}
        }}
      >
        Subscribe $1/mo
      </button>
      <div className="mt-5 grid gap-2">
        <div className="h-24 rounded-lg border border-white/10 bg-white/5 animate-pulse" />
        <div className="h-10 rounded-lg border border-white/10 bg-white/5 animate-pulse" />
      </div>
    </div>
  );
}
