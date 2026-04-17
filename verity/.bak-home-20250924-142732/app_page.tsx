import Link from "next/link";
import LiveCounters from "../components/home/LiveCounters";
import PostcodeForm from "../components/home/PostcodeForm";
import Hotkeys from "../components/home/Hotkeys";

type Bill = { id: string; title: string; status: string | null; updated_at: string | null };

function env(name: string, fallback = "") { return process.env[name] ?? fallback; }

async function getCounts() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anon) return { bills: 0, mps: 0, preview: [] as Bill[] };
  const headers = { apikey: anon, Authorization: `Bearer ${anon}`, Prefer: "count=exact" };

  const billsReq = fetch(`${url}/rest/v1/bills?select=id&limit=1`, { headers, next: { revalidate: 60 } });
  const mpsReq   = fetch(`${url}/rest/v1/mps?select=id&limit=1`,   { headers, next: { revalidate: 60 } });
  const listReq  = fetch(`${url}/rest/v1/bills?select=id,title,status,updated_at&order=updated_at.desc.nullslast&limit=3`,
                         { headers, next: { revalidate: 60 } });

  const [billsRes, mpsRes, listRes] = await Promise.all([billsReq, mpsReq, listReq]);

  const billsCR = billsRes.headers.get("content-range");
  const mpsCR   = mpsRes.headers.get("content-range");
  const bills   = billsCR?.includes("/") ? Number(billsCR.split("/")[1]) : 0;
  const mps     = mpsCR?.includes("/") ? Number(mpsCR.split("/")[1]) : 0;
  const preview = (await listRes.json()) as Bill[];

  return { bills: bills || 0, mps: mps || 0, preview };
}

function BillChip({ b }: { b: Bill }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-200">
      <span className="truncate">{b.title}</span>
      {b.status && <span className="ml-2 shrink-0 text-xs text-zinc-400">• {b.status}</span>}
    </div>
  );
}

export default async function Home() {
  const { bills: billsCount, mps: mpsCount, preview: billsPreview } = await getCounts();

  return (
    <main className="min-h-screen bg-black text-zinc-200">
      <Hotkeys />
      <div className="mx-auto max-w-6xl px-4 py-10 hero-glow">
        <div className="mb-6 flex items-center gap-2 text-xs text-emerald-300/80">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Verity <span className="rounded-full border border-emerald-900/60 bg-emerald-900/10 px-2 py-0.5 text-emerald-300/80">Live beta</span>
        </div>

        <h1 className="text-balance text-4xl font-semibold leading-tight text-emerald-300 md:text-6xl">
          Transparent politics, made simple.
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Verity pulls bills, votes and MPs into one clean feed. Built for Australians.
        </p>

        {/* actions */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/bills"
            className="inline-flex items-center gap-3 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-2 text-emerald-300 ring-1 ring-emerald-900/40 hover:border-emerald-800 hover:ring-emerald-700/40"
            aria-label="Browse bills"
          >
            Browse bills
            <span className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300">{billsCount}</span>
          </Link>

          <PostcodeForm />
        </div>

        {/* quick tiles */}
        <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link href="/news" className="group rounded-2xl border border-zinc-800 p-5 transition-colors hover:border-zinc-700">
            <div className="text-sm text-zinc-400">Feed</div>
            <div className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-emerald-300">Latest political news</div>
            <p className="mt-1 text-sm text-zinc-500">Top headlines curated for context.</p>
          </Link>

          <Link href="/bills" className="group rounded-2xl border border-zinc-800 p-5 transition-colors hover:border-zinc-700">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Parliament</span>
              <span className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300">{billsCount} live</span>
            </div>
            <div className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-emerald-300">Bills &amp; stages</div>
            {billsPreview.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {billsPreview.map((b) => <BillChip key={b.id} b={b} />)}
              </div>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">Track reading stage and recent movement.</p>
            )}
          </Link>

          <Link href="/mps" className="group rounded-2xl border border-zinc-800 p-5 transition-colors hover:border-zinc-700">
            <div className="text-sm text-zinc-400">Representatives</div>
            <div className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-emerald-300">Find your MP</div>
            <p className="mt-1 text-sm text-zinc-500">{mpsCount} MPs in database.</p>
          </Link>
        </section>

        <footer className="mt-16 border-t border-zinc-900/70 pt-6 text-sm text-zinc-500">
          © {new Date().getFullYear()} Verity — Built for Australians.
        </footer>
      </div>

      <LiveCounters initial={{ bills: billsCount, mps: mpsCount }} />
    </main>
  );
}
