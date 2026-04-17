// src/app/(site)/me/page.tsx
"use client";
import { useSubscription } from "@/components/Shell";

export default function AccountPage() {
  const { sub, subscribe, unsubscribe } = useSubscription();
  return (
    <div className="mx-auto max-w-md">
      <h2 className="text-2xl font-semibold tracking-tight">Account (Preview)</h2>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm">Status: {sub ? "Subscribed" : "Not subscribed"}</div>
        <div className="mt-3 flex gap-2">
          {!sub ? (
            <button
              onClick={subscribe}
              className="rounded-xl bg-emerald-400 text-neutral-900 px-4 py-2 font-semibold hover:bg-emerald-300"
            >
              Subscribe $1/mo
            </button>
          ) : (
            <button
              onClick={unsubscribe}
              className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/5"
            >
              Unsubscribe
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Preview mode: this simulates a magic-link/OAuth + billing state with localStorage only.
        </p>
      </div>
    </div>
  );
}
