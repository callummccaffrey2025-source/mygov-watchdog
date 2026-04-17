import Link from "next/link";

type MPMini = { slug: string; name: string; party?: string; state?: string };
async function fetchSimilar(slug: string, party?: string|null, state?: string|null): Promise<MPMini[]> {
  try {
    const qs = new URLSearchParams();
    if (party) qs.set("party", party);
    if (state) qs.set("state", state);
    qs.set("limit", "6");
    const url = `${process.env.VERITY_BACKEND_URL ?? ""}/mps?${qs.toString()}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.items ?? []).filter((m: any) => m.slug !== slug).slice(0,6).map((m: any) => ({ slug: m.slug, name: m.name, party: m.party, state: m.state }));
  } catch { return []; }
}

export default async function SimilarMPs({ slug, party, state }: { slug: string; party?: string|null; state?: string|null }) {
  const items = await fetchSimilar(slug, party ?? undefined, state ?? undefined);
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {items.map(m => (
        <Link key={m.slug} href={`/mps/${m.slug}`} className="rounded-lg border border-white/10 bg-black/20 p-3 hover:bg-white/5">
          <div className="text-sm font-medium">{m.name}</div>
          <div className="text-xs text-white/60">{[m.party, m.state].filter(Boolean).join(" • ")}</div>
        </Link>
      ))}
    </div>
  );
}
