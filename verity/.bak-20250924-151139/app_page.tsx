import Link from "next/link";
import Analytics from "../components/site/Analytics";
import ValueProps from "../components/home/ValueProps";
import HowItWorks from "../components/home/HowItWorks";
import Testimonials from "../components/home/Testimonials";
import LogosBand from "../components/home/LogosBand";
import EmailCapture from "../components/home/EmailCapture";
import TrendingBills from "../components/home/TrendingBills";

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

async function count(table: string): Promise<number> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anon) return 0;
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, Prefer: "count=exact" },
    next: { revalidate: 30 },
  });
  const cr = res.headers.get("content-range") || "";
  const total = parseInt(cr.split("/").pop() || "0", 10);
  return Number.isFinite(total) ? total : 0;
}

export default async function Home() {
  const [billsCount, mpsCount] = await Promise.all([count("bills"), count("mps")]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Verity",
    "url": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    "description": "Built for Australians.",
  };

  return (
    <main className="min-h-screen bg-black text-zinc-200">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* mini breadcrumb/status */}
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40"></span>
          </span>
          Verity <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-xs">Live beta</span>
        </div>

        {/* hero */}
        <section className="mt-6">
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-emerald-300">
            Transparent politics, made simple.
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Verity pulls bills, votes and MPs into one clean feed. Built for Australians.
          </p>

          {/* micro KPIs */}
          <div className="mt-3 text-sm text-zinc-500">
            <span className="text-emerald-300">{billsCount}</span> live bills ·{" "}
            <span className="text-emerald-300">{mpsCount}</span> MPs in database
          </div>

          {/* CTAs */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/bills"
              className="inline-flex items-center rounded-xl bg-emerald-400/10 px-4 py-2 text-emerald-300 ring-1 ring-emerald-700 hover:ring-emerald-600/40"
            >
              Browse bills
            </Link>
            <div className="flex items-center gap-2">
              <input
                placeholder="Postcode"
                className="w-36 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              />
              <Link
                href="/mps"
                className="rounded-xl border border-zinc-800 px-4 py-2 text-zinc-200 hover:border-zinc-700"
              >
                Find your MP
              </Link>
            </div>
            <Link
              href="/signup"
              className="rounded-xl border border-emerald-700 px-4 py-2 text-emerald-300 hover:border-emerald-600/40"
            >
              Start free
            </Link>
          </div>
        </section>

        {/* value props */}
        <ValueProps />

        {/* primary cards */}
        <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href="/news"
            className="group rounded-2xl border border-zinc-800 p-5 hover:border-zinc-700 transition-colors"
          >
            <div className="text-sm text-zinc-400">Feed</div>
            <div className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-emerald-300">
              Latest political news
            </div>
            <p className="mt-1 text-sm text-zinc-500">Top headlines curated for context.</p>
          </Link>

          <div className="rounded-2xl border border-zinc-800 p-5">
            <div className="text-sm text-zinc-400">Parliament</div>
            <div className="mt-1 text-lg font-medium text-zinc-100">Bills & stages</div>
            {/* trending bills */}
            {/* @ts-expect-error Async Server Component */}
            <TrendingBills />
          </div>

          <Link
            href="/mps"
            className="group rounded-2xl border border-zinc-800 p-5 hover:border-zinc-700 transition-colors"
          >
            <div className="text-sm text-zinc-400">Representatives</div>
            <div className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-emerald-300">
              Find your MP
            </div>
            <p className="mt-1 text-sm text-zinc-500">{mpsCount} MPs in database.</p>
          </Link>
        </section>

        {/* social proof + email capture */}
        <LogosBand />
        <EmailCapture />
        <HowItWorks />
        <Testimonials />

        {/* footer */}
        <footer className="mt-16 border-t border-zinc-900/70 pt-6 text-sm text-zinc-500">
          © {new Date().getFullYear()} Verity — Built for Australians.
        </footer>
      </div>

      {/* analytics (plausible) */}
      <Analytics provider="plausible" siteId="yourdomain.com" />
    </main>
  );
}
