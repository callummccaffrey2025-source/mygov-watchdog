export const dynamic = "force-dynamic";
export const revalidate = 3600;
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

type BillRow = {
  id: string;
  title: string | null;
  chamber: string | null;
  stage: string | null;
  source_url: string | null;
};

async function getBills(): Promise<BillRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("bills_mv").select("id,title,chamber,stage,source_url").limit(100);
  if (error) { console.error("bills_mv error", error); return []; }
  return data ?? [];
}

export default async function BillsPage() {
  const bills = await getBills();
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-3xl font-semibold">Bills</h1>
      {!bills.length ? (
        <div className="text-white/70">No bills available.</div>
      ) : (
        <ul className="space-y-3">
          {bills.map((b) => (
            <li key={b.id} className="rounded-xl border border-white/10 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link className="text-lg font-medium underline" href={`/bills/${b.id}`}>
                    {b.title ?? "Untitled Bill"}
                  </Link>
                  <div className="text-white/70 text-sm">
                    {b.chamber ?? "Chamber"} · {b.stage ?? "Stage"}
                  </div>
                </div>
                {b.source_url ? (
                  <a href={b.source_url} target="_blank" rel="noreferrer"
                     className="text-sm underline opacity-80">Source</a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
