'use client';
export function PartyBadge({ party }: { party: string }) {
  const map: Record<string, string> = {
    Labor:'bg-red-500/20 text-red-200 border-red-700/40',
    Liberal:'bg-blue-500/20 text-blue-200 border-blue-700/40',
    National:'bg-green-500/20 text-green-200 border-green-700/40',
    Greens:'bg-emerald-500/20 text-emerald-200 border-emerald-700/40',
    Independent:'bg-zinc-500/20 text-neutral-100 border-zinc-600/40',
  };
  const cls = map[party] || 'bg-zinc-500/20 text-neutral-100 border-zinc-600/40';
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${cls}`}>{party}</span>;
}
