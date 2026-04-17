import { headers } from 'next/headers';

// Server Component: shows a compact list of trending bill movements.
// Hidden unless NEXT_PUBLIC_SHOW_TRENDING === "1". API returns 204 when empty.

type TrendingItem = {
  id: string;
  title: string;
  chamber: 'House' | 'Senate' | 'Assembly' | 'Legislative Council' | 'Legislative Assembly';
  lastMovementAt: string;
  status: string;
  url?: string;
};

async function getTrending(): Promise<TrendingItem[] | null> {
  if (process.env.NEXT_PUBLIC_SHOW_TRENDING !== '1') return null;

  const h = await headers(); // <-- awaited
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = (h.get('x-forwarded-proto') ?? 'http').replace(/[^a-z]/g, '') || 'http';
  if (!host) return null;
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/trending`, { cache: 'no-store' });
  if (!res.ok) {
    if (res.status === 204) return null;
    return null;
  }
  const data = (await res.json()) as TrendingItem[] | null;
  if (!data || data.length === 0) return null;
  return data.slice(0, 5);
}

function timeAgo(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const diff = Math.max(0, now.getTime() - then.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function TrendingToday() {
  const items = await getTrending();
  if (!items) return null;

  return (
    <section aria-labelledby="trending-heading" className="mt-6">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="trending-heading" className="text-sm font-semibold text-neutral-200">
            Trending today
          </h2>
          <span className="text-xs text-neutral-400">Bill movement</span>
        </div>
        <ul className="divide-y divide-neutral-800">
          {items.map((it) => {
            const content = (
              <div className="flex w-full items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-100">{it.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {it.chamber} · {it.status}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300">
                  {timeAgo(it.lastMovementAt)}
                </span>
              
                <span aria-hidden="true" className="ml-3 shrink-0 text-neutral-500 group-hover:text-neutral-300">→</span>
              </div>
            );
    
            return (
              <li key={it.id}>
                {it.url ? (
                  <a href={it.url}
                    className="group block hover:bg-neutral-900/60 focus:outline-none focus:ring-2 focus:ring-neutral-600 rounded-lg -mx-2 px-2"
                  >
                    {content}
                  </a>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
