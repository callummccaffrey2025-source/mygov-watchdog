import Link from "next/link";
type MP = { id: string; name: string; electorate?: string; party?: string; state?: string; };

async function getAll(): Promise<MP[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${base}/api/mps`, { cache: "no-store" }).catch(()=>null);
  const r = res?.ok ? res : await fetch(`/api/mps`, { cache: "no-store" }).catch(()=>null as any);
  const data = await r?.json().catch(()=>({items:[]}));
  return (data?.items ?? []) as MP[];
}

export const metadata = { title: "MPs • Verity" };

export default async function MPsPage(){
  const mps = await getAll();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold mb-6">Members of Parliament</h1>
      {mps.length === 0 ? (
        <div className="rounded-xl border border-white/10 p-6 text-sm text-neutral-400">
          No MPs yet. (Hook up Supabase/ingestion when ready.)
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mps.map(m => (
            <li key={m.id} className="rounded-xl border border-white/10 p-4">
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-neutral-400">{[m.party, m.electorate, m.state].filter(Boolean).join(" • ")}</div>
              <Link className="inline-block mt-3 text-sm underline text-emerald-400" href={`/mps/${m.id}`}>View profile</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
