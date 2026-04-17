import Link from "next/link";

/* SSR cache */
export const revalidate = 30;
export const dynamic = "force-dynamic";

/* ---- types ---- */
type Bill = {
  id: string;
  title: string;
  status: string | null;
  updated_at?: string | null;
};

/* ---- helpers ---- */
function env(name: string, fallback = ""): string {
  const v = process.env[name] ?? fallback;
  if (!v) console.warn(`[bills] missing env ${name}`);
  return v;
}
function sparam(v?: string | string[] | null): string | null {
  if (Array.isArray(v)) return (v[0] ?? "").trim() || null;
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/* ---- data fetch ---- */
async function getBills(opts: { q: string | null; status: string | null; page: number }) {
  const limit = 12;
  const offset = (Math.max(1, opts.page) - 1) * limit;

  const urlBase = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const select = "id,title,status,updated_at";
  const params: string[] = [
    `select=${select}`,
    `order=updated_at.desc.nullslast`,
    `limit=${limit}`,
    `offset=${offset}`,
  ];
  if (opts.q) params.push(`title=ilike.*${encodeURIComponent(opts.q)}*`);
  if (opts.status) params.push(`status=eq.${encodeURIComponent(opts.status)}`);

  const url = `${urlBase}/rest/v1/bills?${params.join("&")}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Prefer: "count=exact",
      },
      next: { revalidate: 30 },
    });
  } catch (e) {
    console.error("Bills fetch failed (network):", e);
    return { items: [] as Bill[], total: 0, limit, offset };
  }
  if (!res.ok) {
    console.error("Bills fetch failed (HTTP):", res.status, await res.text().catch(() => "(no body)"));
    return { items: [] as Bill[], total: 0, limit, offset };
  }
  const items = (await res.json()) as Bill[];
  const cr = res.headers.get("content-range");
  const total = cr && cr.includes("/") ? Number(cr.split("/")[1]) : items.length;
  return { items, total, limit, offset };
}

/* ---- UI bits ---- */
function StatusBadge({ s }: { s: string | null }) {
  if (!s) return null;
  const map: Record<string, string> = {
    "Introduced": "bg-emerald-900/40 text-emerald-300 ring-emerald-700/50",
    "Second reading": "bg-emerald-900/40 text-emerald-300 ring-emerald-700/50",
    "Committee": "bg-emerald-900/40 text-emerald-300 ring-emerald-700/50",
  };
  const cls = map[s] ?? "bg-zinc-900/40 text-zinc-300 ring-zinc-700/40";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${cls}`}>
      {s}
    </span>
  );
}
function Card({ bill }: { bill: Bill }) {
  const d = bill.updated_at ? new Date(bill.updated_at) : null;
  const when = d ? d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

  return (
    <article className="group rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 ring-1 ring-transparent transition hover:border-emerald-800/60 hover:ring-emerald-700/40">
      <h3 className="text-zinc-100 group-hover:text-emerald-300 transition font-medium">
        {bill.title}
      </h3>
      <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
        <StatusBadge s={bill.status} />
        {when && <span className="text-zinc-500">•</span>}
        {when && <span className="text-zinc-400">{when}</span>}
      </div>
    </article>
  );
}
function Toolbar({ q, status, total }: { q: string | null; status: string | null; total: number }) {
  return (
    <form className="mb-6 grid gap-3 sm:grid-cols-[1fr,220px,auto]">
      <input
        defaultValue={q ?? ""}
        name="q"
        placeholder="Search bills…"
        className="rounded-xl bg-zinc-950 text-zinc-200 placeholder-zinc-500 ring-1 ring-zinc-800 focus:outline-none focus:ring-emerald-700/50 px-3 py-2"
      />
      <select
        name="status"
        defaultValue={status ?? ""}
        className="rounded-xl bg-zinc-950 text-zinc-200 ring-1 ring-zinc-800 focus:outline-none focus:ring-emerald-700/50 px-3 py-2"
      >
        <option value="">All statuses</option>
        <option value="Introduced">Introduced</option>
        <option value="Second reading">Second reading</option>
        <option value="Committee">Committee</option>
      </select>
      <button
        className="rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-black font-medium px-4 py-2 transition"
        type="submit"
      >
        Apply
      </button>
      <div className="sm:col-span-3 -mt-1 text-sm text-zinc-500">{total} total</div>
    </form>
  );
}
function Pager({ page, total }: { page: number; total: number }) {
  const limit = 12;
  const pages = Math.max(1, Math.ceil(total / limit));
  const prev = Math.max(1, page - 1);
  const next = Math.min(pages, page + 1);
  const link = (p: number, label: string, disabled: boolean) => (
    <Link
      href={`/bills?page=${p}`}
      className={`rounded-xl px-3 py-1.5 ring-1 transition ${
        disabled
          ? "cursor-not-allowed text-zinc-600 ring-zinc-800"
          : "text-emerald-300 ring-zinc-700 hover:ring-emerald-600/40"
      }`}
      prefetch={false}
      aria-disabled={disabled}
    >
      {label}
    </Link>
  );
  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      {link(prev, "Prev", page === 1)}
      <span className="text-sm text-zinc-400">Page {page}</span>
      {link(next, "Next", page === pages)}
    </div>
  );
}

/* ---- page ---- */
export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;              // ✅ Next 15: await the promise
  const q = sparam(sp.q as any);
  const status = sparam(sp.status as any);
  const pageStr = sparam(sp.page as any) ?? "1";
  const page = Math.max(1, Number.isFinite(Number(pageStr)) ? Number(pageStr) : 1);

  const { items, total } = await getBills({ q, status, page });

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-emerald-300">Bills</h1>
          <p className="text-zinc-400 mt-1">Live from Supabase • filtered &amp; searchable</p>
        </header>

        <Toolbar q={q} status={status} total={total} />

        {items.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 p-10 text-center text-zinc-400">
            {(q || status) ? "No bills found." : "No bills yet or data unavailable."}
          </div>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {items.map((b) => (
              <Card key={b.id ?? `${b.title}-${b.updated_at ?? ""}`} bill={b} />
            ))}
          </section>
        )}

        <Pager page={page} total={total} />
      </div>
    </main>
  );
}
