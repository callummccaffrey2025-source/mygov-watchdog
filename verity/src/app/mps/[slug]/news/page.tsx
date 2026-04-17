import type { MPProfile } from "@/types/mp";

async function fetchProfile(slug: string): Promise<MPProfile> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/mps/${slug}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to load MP");
  return res.json();
}

export default async function NewsPage({ params }: { params: { slug: string } }) {
  const mp = await fetchProfile(params.slug);
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-3 py-6">
      <h1 className="text-lg font-semibold">{mp.name} — news</h1>
      <ul className="space-y-3">
        {mp.news.length ? mp.news.map(n => (
          <li key={n.id} className="rounded-lg border border-white/10 p-3">
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="block">
              <div className="flex items-center justify-between gap-3">
                <h4 className="line-clamp-2 text-sm font-medium">{n.title}</h4>
                <span className="shrink-0 text-xs text-white/60">{new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric'}).format(new Date(n.published_at))}</span>
              </div>
              {!!n.source && <p className="mt-1 text-xs text-white/50">{n.source}</p>}
            </a>
          </li>
        )) : <p className="text-white/60">No recent news found.</p>}
      </ul>
    </main>
  );
}
