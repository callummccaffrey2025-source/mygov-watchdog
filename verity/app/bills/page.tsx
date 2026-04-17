// app/bills/page.tsx
import Link from "next/link";

/* SSR cache */
export const revalidate = 30;
export const dynamic = "force-dynamic";

/* types */
type Bill = {
  id: string;
  title: string;
  status: string | null;
  updated_at?: string | null;
};

/* helpers */
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

/* data fetch */
async function getBills(opts: { q: string | null; status: string | null; page: number }) {
  const limit = 12;
  const offset = Math.max(1, opts.page) - 1 * limit;

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

/* UI bits */
function StatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <span className="rounded-full border border-emerald-900/60 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-300">
      {status}
    </span>
  );
}
function Card({ bill }: { bill: Bill }) {
  const date = bill.updated_at ? new Date(bill.updated_at) : null;
  const meta = [date ? date.toLocaleDateString() : null].filter(Boolean).join(" • ");
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 hover:border-zinc-700 transition-colors">
      <h3 className="text-zinc-100 font-medium">{bill.title}</h3>
      <div className="mt-2 flex items-center justify-between">
        <StatusPill status={bill.status} />
        <span className="text-xs text-zinc-500">{meta}</span>
      </div>
    </article>
  );
}

function Toolbar({ q, status, total }: { q: string | null; status: string | null; total: number }) {
  return (
    <form className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search bills…"
          className="w-64 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-600"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-600"
        >
          <option value="">All statuses</option>
          <option value="Introduced">Introduced</option>
          <option value="Second reading">Second reading</option>
          <option value="Committee">Committee</option>
          {/* add your other statuses if any */}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-black font-medium px-3 py-2 text-sm transition-colors"
        >
          Apply
        </button>
      </div>
      <div className="text-sm text-zinc-400">{total} total</div>
    </form>
  );
}

function Pager({ page, total, perPage = 12 }: { page: number; total: number; perPage?: number }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const prev = Math.max(1, page - 1);
  const next = Math.min(pages, page + 1);

  const link = (p: number, label: string, disabled?: boolean) => (
    <Link
      href={{ pathname: "/bills", query: { page: p } }}
      className={`rounded-xl border px-3 py-1.5 text-sm ${
        disabled
          ? "cursor-not-allowed border-zinc-800 text-zinc-600"
          : "border-zinc-700 text-zinc-300 hover:border-emerald-600 hover:text-emerald-300"
      }`}
      aria-disabled={disabled}
    >
      {label}
    </Link>
  );

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      {link(prev, "Prev", page === 1)}
      <span className="text-sm text-zinc-400">Page {page} / {pages}</span>
      {link(next, "Next", page === pages)}
    </div>
  );
}

/* page */
export default async function BillsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = sparam(searchParams.q as unknown);
  const status = sparam(searchParams.status as unknown);
  const pageStr = sparam(searchParams.page as unknown) ?? "1";
  const page = Math.max(1, Number.isFinite(Number(pageStr)) ? Number(pageStr) : 1);

  const { items, total } = await getBills({ q, status, page });

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-emerald-300">Bills</h1>
          <p className="text-zinc-400 mt-1">Live from Supabase • filtered & searchable</p>
        </header>

        <Toolbar q={q} status={status} total={total} />

        {items.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 p-8 text-center text-zinc-400">
            {(q || status) ? "No bills found." : "No bills yet or data unavailable."}
          </div>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {items.map((b) => (
              <Card key={b.id} bill={b} />
            ))}
          </section>
        )}

        <Pager page={page} total={total} />
      </div>
    </main>
  );
}
