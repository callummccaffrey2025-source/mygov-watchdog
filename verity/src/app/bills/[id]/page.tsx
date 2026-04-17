// src/app/bills/[id]/page.tsx
type Bill = { id:string; title:string; stage?:string; introduced?:string; sponsor?:string; progress?:number; summary?:string; status?:string };

async function getBill(id:string): Promise<Bill|null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const r = await fetch(`${base}/api/bills/${id}`, { cache: "no-store" }).catch(()=>null as any);
  const rr = r?.ok ? r : await fetch(`/api/bills/${id}`, { cache:"no-store" }).catch(()=>null as any);
  const j = rr?.ok ? await rr.json() : null;
  return (j?.item ?? null) as Bill | null;
}

export default async function BillDetail({ params }:{ params:{ id:string } }){
  const bill = await getBill(params.id);
  if (!bill) return <main className="mx-auto max-w-3xl px-6 py-10">Not found.</main>;
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold mb-2">{bill.title}</h1>
      <div className="text-sm text-neutral-400 mb-6">
        {(bill.stage ?? "—")} · {(bill.introduced ?? "—")} {bill.sponsor ? ("· " + bill.sponsor) : ""}
      </div>
      {bill.summary && <p className="text-neutral-300">{bill.summary}</p>}
      {typeof bill.progress === "number" && (
        <div className="mt-6">
          <div className="text-sm mb-2">Progress: {bill.progress}%</div>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full" style={{ backgroundColor: "rgb(16 185 129)", width: `${Math.min(100,Math.max(0,Math.round(bill.progress)))}%` }} />
          </div>
        </div>
      )}
    </main>
  );
}
