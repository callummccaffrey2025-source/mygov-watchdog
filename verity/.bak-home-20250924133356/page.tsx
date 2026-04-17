import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verity — Transparent politics, made simple.",
  description:
    "Verity pulls bills, votes and MPs into one clean feed. Built for Australians.",
  openGraph: {
    title: "Verity — Transparent politics, made simple.",
    description:
      "Verity pulls bills, votes and MPs into one clean feed. Built for Australians.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Verity — Transparent politics, made simple.",
    description:
      "Verity pulls bills, votes and MPs into one clean feed. Built for Australians.",
  },
  themeColor: "#0a0a0a",
};

function env(name: string, fallback = ""): string {
  const v = process.env[name] ?? fallback;
  return String(v);
}

async function fetchCount(table: "bills" | "mps"): Promise<number> {
  const urlBase = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!urlBase || !anon) return 0;

  const url = `${urlBase}/rest/v1/${table}?select=id&limit=1`;
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
  } catch {
    return 0;
  }
  if (!res.ok) return 0;
  const cr = res.headers.get("content-range");
  return cr && cr.includes("/") ? Number(cr.split("/")[1]) : 0;
}

async function getCounts() {
  const [bills, mps] = await Promise.all([fetchCount("bills"), fetchCount("mps")]);
  return { bills, mps };
}

export default async function Home() {
  const { bills, mps } = await getCounts();

  return (
    <main className="min-h-screen bg-black text-zinc-200">
      <header className="sticky top-0 z-40 border-b border-zinc-900/70 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="group inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400/90 ring-2 ring-emerald-400/20" />
            <span className="text-lg font-semibold text-emerald-300">Verity</span>
            <span className="rounded border border-emerald-400/20 px-2 py-0.5 text-[11px] text-emerald-300/90">
              Live beta
            </span>
          </Link>

          <nav className="hidden gap-6 md:flex">
            <Link href="/news" className="text-sm text-zinc-300 hover:text-emerald-300">News</Link>
            <Link href="/mps"  className="text-sm text-zinc-300 hover:text-emerald-300">MPs</Link>
            <Link href="/bills" className="text-sm text-zinc-300 hover:text-emerald-300">Bills</Link>
            <Link href="/pricing" className="text-sm text-zinc-300 hover:text-emerald-300">Pricing</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-4 pt-10 sm:pt-14">
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-emerald-300 sm:text-5xl">
          Transparent politics, made simple.
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Verity pulls bills, votes and MPs into one clean feed. Built for Australians.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/bills"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/15 px-4 py-2 text-emerald-300 ring-1 ring-emerald-600/30 transition hover:bg-emerald-600/20 hover:ring-emerald-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            prefetch={false}
          >
            <span className="font-medium">Browse bills</span>
            {/* Count badge rendered if present */}
            {typeof (await getCounts()).bills === "number" && (await getCounts()).bills > 0 && (
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-500/20">
                {(await getCounts()).bills.toLocaleString()}
              </span>
            )}
            <span aria-hidden>→</span>
          </Link>
          <div className="inline-flex items-center">
            {/* client component */}
            <PostcodeLookup />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-4 px-4 md:grid-cols-3">
        <CardLink
          href="/news"
          eyebrow="Feed"
          title="Latest political news"
          blurb="Top headlines curated for context."
        />
        <CardLink
          href="/bills"
          eyebrow="Parliament"
          title="Bills & stages"
          blurb="Track reading stage and recent movement."
          kicker={(await getCounts()).bills > 0 ? `${(await getCounts()).bills.toLocaleString()} live` : undefined}
        />
        <CardLink
          href="/mps"
          eyebrow="Representatives"
          title="Find your MP"
          blurb={(await getCounts()).mps > 0 ? `${(await getCounts()).mps.toLocaleString()} MPs in database.` : "By postcode or name."}
        />
      </section>

      <footer className="mx-auto mt-14 max-w-6xl border-t border-zinc-900/70 px-4 py-6 text-sm text-zinc-500">
        © {new Date().getFullYear()} Verity — Built for Australians
      </footer>
    </main>
  );
}

function CardLink({
  href,
  eyebrow,
  title,
  blurb,
  kicker,
}: {
  href: string;
  eyebrow: string;
  title: string;
  blurb: string;
  kicker?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-zinc-800 p-5 ring-1 ring-transparent transition-colors hover:border-zinc-700 hover:ring-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      prefetch={false}
    >
      <div className="text-sm text-zinc-400">{eyebrow}</div>
      <div className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-emerald-300">
        {title}
      </div>
      <p className="mt-1 text-sm text-zinc-500">{blurb}</p>
      {kicker && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-zinc-900/60 px-2 py-1 text-xs text-zinc-400 ring-1 ring-zinc-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          {kicker}
        </div>
      )}
    </Link>
  );
}

import PostcodeLookup from "./postcode-lookup";
