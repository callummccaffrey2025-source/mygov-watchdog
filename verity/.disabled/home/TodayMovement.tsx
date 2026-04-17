import Link from "next/link";
import { srest } from "../../lib/supaRest";

type Bill = { id:string; title:string; status:string | null; updated_at:string | null };

export default async function TodayMovement() {
  const since = new Date(); since.setHours(0,0,0,0);
  let items: Bill[] = [];
  try {
    // updated today (server time); tweak if your column name differs
    items = await srest(`/rest/v1/bills?select=id,title,status,updated_at&updated_at=gte.${since.toISOString()}&order=updated_at.desc&limit=6`);
  } catch {}
  if (!items?.length) return null;

  return (
    <section className="mt-8">
      <h3 className="text-sm text-zinc-400">Today’s movement</h3>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(b => (
          <Link
            key={b.id}
            href={`/bills/${b.id}`}
            className="group rounded-xl border border-zinc-800 p-3 hover:border-zinc-700"
          >
            <div className="truncate text-zinc-200 group-hover:text-emerald-300">{b.title}</div>
            <div className="mt-1 text-xs text-zinc-500">{b.status || "Updated"}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
