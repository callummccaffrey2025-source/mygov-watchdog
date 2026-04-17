// src/components/Shell.tsx
"use client";

import React, { useEffect, useState } from "react";

const LS_SUB = "verity.sub" as const; // stores "true"/"false" in localStorage

export function useSubscription() {
  const [sub, setSub] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SUB);
      setSub(raw ? JSON.parse(raw) : false);
    } catch {
      setSub(false);
    }
  }, []);

  const set = (val: boolean) => {
    try {
      localStorage.setItem(LS_SUB, JSON.stringify(val));
    } catch {}
    setSub(val);
  };

  return {
    sub,
    subscribe: () => set(true),
    unsubscribe: () => set(false),
  };
}

/**
 * Curtain: wrapper that renders children when subscribed,
 * otherwise shows the paywall UI. `onSub` is optional.
 */
export function Curtain({
  children,
  onSub,
}: {
  children?: React.ReactNode;
  onSub?: () => void;
}) {
  const { sub, subscribe } = useSubscription();

  if (sub) return <>{children}</>;

  const handleSubscribe = () => {
    subscribe();
    onSub?.();
  };

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-400/40 bg-neutral-900/80 p-8 text-center">
      <h2 className="text-2xl font-semibold">Subscribe to unlock</h2>
      <p className="mt-2 text-neutral-400 text-sm">
        Unlimited Verity for just <span className="font-semibold">$1/month</span>.
      </p>
      <button
        onClick={handleSubscribe}
        className="mt-4 rounded-xl bg-emerald-400 text-neutral-900 px-5 py-3 font-semibold hover:bg-emerald-300"
      >
        Subscribe $1/mo
      </button>
    </div>
  );
}

/**
 * PaywallGuard: convenience component if you prefer guard semantics.
 * Equivalent to <Curtain>{children}</Curtain>.
 */
export function PaywallGuard({ children }: { children: React.ReactNode }) {
  return <Curtain>{children}</Curtain>;
}
