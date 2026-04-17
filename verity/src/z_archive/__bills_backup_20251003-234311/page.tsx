type Bill = { id:string; title:string; stage?:string; introduced?:string; sponsor?:string; progress?:number; summary?:string; status?:string };

async function getBills(): Promise<Bill[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const r = await fetch(`${base}/api/bills`, { cache: "no-store" }).catch(()=>null as any);
  const rr = r?.ok ? r : await fetch(`/api/bills`, { cache:"no-store" }).catch(()=>null as any);
  const j = rr?.ok ? await rr.json() : null;
  return (j?.items ?? []) as Bill[];
}

export default async function BillsPage(){
  const items = await getBills();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold mb-4">Bills</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map(b=>(
          <a key={b.id} href={`/bills/${b.id}`} className="rounded-xl border border-white/10 p-4 hover:border-emerald-400/40">
            <div className="font-medium">{b.title}</div>
            <div className="text-xs text-neutral-400">
              {(b.stage ?? "—")} · {(b.introduced ?? "—")}
            </div>
          </a>
        ))}
        {!items.length && <div className="text-neutral-400">No bills yet.</div>}
      </div>
    </main>
  );
}
