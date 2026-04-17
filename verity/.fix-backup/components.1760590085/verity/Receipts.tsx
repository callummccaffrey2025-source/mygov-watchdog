'use client';
import Link from 'next/link';
import type { Receipt } from './SourceGuard';

export function Receipts({ items }: { items: Receipt[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-sm">
      <div className="mb-2 font-semibold">Receipts</div>
      <ul className="space-y-2">
        {items.map((r, i) => (
          <li key={i} className="text-neutral-100">
            <Link href={r.url} className="underline" target="_blank">
              {r.label ?? r.url}
            </Link>
            {r.publisher && (
              <span className="ml-2 text-xs text-neutral-100">
                ({r.publisher}{r.date ? ` · ${r.date}` : ''})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
