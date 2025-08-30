// app/search/page.tsx
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";

function ensureStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function Results({ q }: { q: string }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/search?q=${encodeURIComponent(q)}`, {
    method: "GET",
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`search failed: ${res.status}`);
  }
  const data = await res.json() as {
    hits: Array<{ id: string; title: string; url: string; snippet?: string; score?: number; published_at?: string }>;
  };
  if (!data?.hits) return <div className="text-sm text-gray-500">No results.</div>;

  return (
    <ul className="space-y-3">
      {data.hits.map((h) => (
        <li key={h.id} className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 p-4">
          <div className="space-y-1.5">
            <a href={h.url} target="_blank" rel="noreferrer" className="text-lg font-medium hover:underline">
              {h.title || h.url}
            </a>
            {h.published_at && (
              <div className="text-xs text-gray-500">{new Date(h.published_at).toLocaleString()}</div>
            )}
            {h.snippet && <p className="text-sm text-gray-700 dark:text-gray-200">{h.snippet}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function SearchPage(props: { searchParams?: Record<string, string | string[]> }) {
  const q = ensureStr(props.searchParams?.q);
  if (!q) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-gray-600">Add a query via <code>?q=</code> or use the search box.</p>
        <form action="/search" className="flex gap-2 pt-2">
          <input
            name="q"
            placeholder="Search government media, Hansard, gazettes…"
            className="flex-1 h-10 px-3 rounded-md border bg-background"
          />
          <button className="h-10 px-4 rounded-md border">Search</button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <form action="/search" className="flex gap-2">
        <input name="q" defaultValue={q} className="flex-1 h-10 px-3 rounded-md border bg-background" />
        <button className="h-10 px-4 rounded-md border">Search</button>
      </form>
      <Suspense fallback={<div className="text-sm text-gray-500">Loading results…</div>}>
        {/* server component fetch */}
        {/* @ts-expect-error Async Server Component */}
        <Results q={q} />
      </Suspense>
      <div className="pt-2 text-xs text-gray-500">Tip: link directly like <Link href={`/search?q=${encodeURIComponent(q)}`} className="underline">/search?q=…</Link></div>
    </div>
  );
}

