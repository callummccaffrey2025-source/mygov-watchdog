import Link from "next/link";
import LiveCounters from "../components/home/LiveCounters";
import PostcodeForm from "../components/home/PostcodeForm";

/** Types for small preview chips */
type Bill = { id: string; title: string; status: string | null; updated_at: string | null };

function env(name: string, fallback = "") {
  const v = process.env[name] ?? fallback;
  return String(v);
}

/** Fetch counts + a small bills preview from Supabase REST */
async function loadHome() {
  const base = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const headers = { apikey: anon, Authorization: `Bearer ${anon}`, Prefer: "count=exact" };

  async function fetchJson<T>(url: string): Promise<{ items: T; total: number }> {
    const res = await fetch(url, { headers, next: { revalidate: 30 } });
    if (!res.ok) return { items: [] as unknown as T, total: 0 };
    const j = (await res.json()) as T;
    const cr = res.headers.get("content-range");
    const total = cr && cr.includes("/") ? Number(cr.split("/")[1]) : (Array.isArray(j) ? j.length : 0);
    return { items: j, total };
  }

  // counts
  const [{ total: billsCount }] = await Promise.all([
    fetchJson<any[]>(`${base}/rest/v1/bills?select=id&limit=1`)
  ]);
  // MPs count
  const { total: mpsCount } = await fetchJson<any[]>(`${base}/rest/v1/mps?select=id&limit=1`);
  // preview chips (latest 3)
  const { items: billsPreview } = await fetchJson<Bill[]>(
    `${base}/rest/v1/bills?select=id,title,status,updated_at&order=updated_at.desc.nullslast&limit=3`
  );

  return { billsCount, mpsCount, billsPreview };
}

function BillChip({ b }: { b: Bill }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900/40 transition-colors">
      <span className="text-zinc-300">{b.title}</span>
      {b.status && <span className="text-zinc-500">· {b.status}</span>}
    </div>
  );
}

export default async function Home() {
  const { billsCount, mpsCount, billsPreview } = await loadHome();

  return (
    <main className="min-h-screen bg-black text-zinc-200">
      {/* Hero */}
      <section className="relative isolate">
        <div className="pointer-events-none absolute inset-0 hero-emerald" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-6">
          <div className="flex items-center gap-2 text-xs text-emerald-300/80">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span><span className="live-dot animate-pulse-slow" aria-hidden="true"></span><span className="sr-only">Live</span> Verity</span>
            <span className="rounded-full border border-emerald-900/60 px-2 py-0.5 text-[10px] text-emerald-300/80">Live beta</span>
          </div>

          <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight text-emerald-300">
            Transparent politics, made simple.
          </h1>

          <p className="mt-2 text-zinc-400">
            Verity pulls bills, votes and MPs into one clean feed. Built for Australians.
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            <span className="text-emerald-300/90">{billsCount}</span> live bill{billsCount === 1 ? "" : "s"} ·
            <span className="text-emerald-300/90"> {mpsCount}</span> MPs in database
          </p>

          {/* CTAs */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/bills"
              className="inline-flex items-center rounded-xl bg-emerald-600/15 px-4 py-2 text-emerald-300 ring-1 ring-emerald-700/40 hover:bg-emerald-600/20 hover:ring-emerald-600/40"
            >
              Browse bills
              <span className="ml-2 rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs">{billsCount}</span>
              <span className="ml-2">→</span>
            </Link>

            <PostcodeForm />

            <Link
              href="/pricing"
              className="inline-flex items-center rounded-xl ring-1 ring-emerald-700/60 px-4 py-2 text-emerald-300 hover:ring-emerald-600/50 transition"
            >
              Start free
            </Link>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="mx-auto mt-8 max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href="/news"
            className="group rounded-2xl border border-zinc-800 p-5 hover:border-zinc-700 transition-colors hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-transform"
          >
            <div className="text-sm text-zinc-400">Feed</div>
            <div className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-emerald-300">
              Latest political news
            </div>
            <p className="mt-1 text-sm text-zinc-500">Top headlines curated for context.</p>
          </Link>

          <Link
            href="/bills"
            className="group rounded-2xl border border-zinc-800 p-5 hover:border-zinc-700 transition-colors hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-transform"
          >
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Parliament</span>
              <span className="ml-1 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] text-emerald-300">{billsCount} live</span>
            </div>

            <div className="mt-2 grid gap-2">
              {billsPreview.map((b) => <BillChip key={b.id} b={b} />)}
            </div>
          </Link>

          <Link
            href="/mps"
            className="group rounded-2xl border border-zinc-800 p-5 hover:border-zinc-700 transition-colors hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-transform"
          >
            <div className="text-sm text-zinc-400">Representatives</div>
            <div className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-emerald-300">
              Find your MP
            </div>
            <p className="mt-1 text-sm text-zinc-500">{mpsCount} MPs in database.</p>
          </Link>
        </div>

        <footer className="mt-16 border-t border-zinc-900/70 pt-6 text-sm text-zinc-500">
          © {new Date().getFullYear()} Verity — Built for Australians.
        </footer>
      </section>

      {/* Quiet hydration (counters) */}
      <LiveCounters initial={{ bills: billsCount, mps: mpsCount }} />
    </main>
  );
}
