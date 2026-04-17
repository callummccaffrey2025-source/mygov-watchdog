import Link from "next/link";
import { srest } from "../../lib/supaRest";

type Bill = { id: string; title: string; status: string | null };

export default async function TrendingBills() {
  // view created in db/follows_alerts.sql
  let items: { id:string; title:string; status:string | null; followers_30d:number }[] = [];
  try {
    items = await srest(`/rest/v1/trending_bills?select=id,title,status,followers_30d&order=followers_30d.desc,nullsLast&limit=8`);
  } catch {}
  if (!items?.length) return null;

  return (
    <section className="mt-8">
      <h3 className="text-sm text-zinc-400">Trending bills</h3>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(b => (
          <li key={b.id}>
            <Link href={`/bills/${b.id}`} className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2 hover:border-zinc-700">
              <span className="truncate text-zinc-200">{b.title}</span>
              <span className="ml-3 shrink-0 rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">{b.followers_30d} following</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
