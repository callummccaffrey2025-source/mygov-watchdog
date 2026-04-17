type MP = {
  id: string; name: string;
  electorate?: string; party?: string; state?: string;
  roles?: string[]; votes?: Array<{ motion?: string; billId?: string; vote?: string }>;
};

async function getOne(id: string): Promise<MP | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${base}/api/mps/${id}`, { cache: "no-store" }).catch(() => null);
  const r = res?.ok ? res : await fetch(`/api/mps/${id}`, { cache: "no-store" }).catch(() => null as any);
  if (!r?.ok) return null;
  const j = await r.json();
  return (j?.item ?? null) as MP | null;
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const mp = await getOne(params.id);
  return { title: mp ? `${mp.name} • Verity` : "MP • Verity" };
}

export default async function MPDetailPage({ params }: { params: { id: string } }) {
  const mp = await getOne(params.id);
  if (!mp) return <main className="mx-auto max-w-3xl px-6 py-10">Not found.</main>;
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold">{mp.name}</h1>
      <div className="text-sm text-neutral-400 mb-6">
        {[mp.party, mp.electorate, mp.state].filter(Boolean).join(" • ")}
      </div>
      <section className="rounded-xl border border-white/10 p-4 mb-4">
        <div className="font-medium mb-2">Roles</div>
        <div className="text-sm text-neutral-300">{mp.roles?.length ? mp.roles.join(" • ") : "—"}</div>
      </section>
      <section className="rounded-xl border border-white/10 p-4">
        <div className="font-medium mb-2">Recent votes</div>
        <div className="text-sm text-neutral-300">
          {mp.votes?.length ? (
            <ul className="list-disc pl-5 space-y-1">
              {mp.votes.slice(0,5).map((v, i) => (
                <li key={i}>{v.motion ?? v.billId ?? "Vote"} — {v.vote ?? "—"}</li>
              ))}
            </ul>
          ) : "—"}
        </div>
      </section>
    </main>
  );
}
