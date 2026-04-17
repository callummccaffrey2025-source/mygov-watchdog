"use client";
import type { MPCommittee } from "@/types/mp";

export default function MPCommittees({ items }: { items: MPCommittee[] }) {
  if (!items?.length) return <p className="text-white/60">No committee memberships listed.</p>;
  return (
    <ul className="grid gap-2">
      {items.map((c, i) => (
        <li key={i} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
          <span className="text-sm">{c.name}</span>
          <span className="text-xs text-white/60">{c.role ?? "Member"}</span>
        </li>
      ))}
    </ul>
  );
}
