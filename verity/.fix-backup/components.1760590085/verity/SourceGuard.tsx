'use client';
import { ReactNode } from 'react';
export type Receipt = { url: string; label?: string; publisher?: string; date?: string };

export default function SourceGuard({
  receipts, children, fallback
}: { receipts?: Receipt[]; children: ReactNode; fallback?: ReactNode; }) {
  if (!receipts || receipts.length === 0) {
    return fallback ?? (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-neutral-100">
        This view requires sources ("receipts"). Add at least one official/public source.
      </div>
    );
  }
  return <>{children}</>;
}
