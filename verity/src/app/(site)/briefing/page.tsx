// src/app/(site)/briefing/page.tsx
"use client";
import { useSubscription } from "@/components/Shell";

export default function BriefingPage() {
  const { sub } = useSubscription();
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-semibold tracking-tight">Daily briefing</h2>
      <div
        className={
          "mt-4 rounded-2xl border border-white/10 bg-white/5 p-4" +
          (sub ? "" : " blur-[2px] select-none")
        }
      >
        <h3 className="font-medium">Commonwealth — Energy & Budget</h3>
        <ul className="mt-2 space-y-1 text-sm text-neutral-300">
          <li>• NSW Gazette: coastal hazard zones (11 Jul 2025)</li>
          <li>• Treasury: HECS indexation adjustment</li>
          <li>• Hansard: Question Time — Energy reforms</li>
        </ul>
      </div>
      {!sub && <p className="mt-2 text-xs text-neutral-400">Subscribe to remove blur and unlock full details.</p>}
    </div>
  );
}
export {};
