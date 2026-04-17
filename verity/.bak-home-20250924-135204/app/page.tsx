import Link from "next/link";

export default function Home() {
  return (
    <main className="pb-16">
      {/* Hero */}
      <section className="pt-10 md:pt-14">
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-emerald-300">
          Transparent politics, made simple.
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Verity pulls bills, votes and MPs into one clean feed. Built for Australians.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/bills"
            className="inline-flex items-center rounded-xl bg-emerald-500/15 px-4 py-2 text-emerald-300 ring-1 ring-emerald-600/40 hover:bg-emerald-500/20"
          >
            Browse bills →
          </Link>
          <Link
            href="/mps"
            className="inline-flex items-center rounded-xl border border-zinc-800 px-4 py-2 text-zinc-200 hover:border-zinc-700"
          >
            Find your MP
          </Link>
        </div>
      </section>

      {/* Quick links */}
      <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href="/news"
          className="group rounded-2xl border border-zinc-800 p-5 hover:border-zinc-700"
        >
          <div className="text-sm text-zinc-400">Feed</div>
          <div className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-emerald-300">
            Latest political news
          </div>
        </Link>
        <Link
          href="/bills"
          className="group rounded-2xl border border-zinc-800 p-5 hover:border-zinc-700"
        >
          <div className="text-sm text-zinc-400">Parliament</div>
          <div className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-emerald-300">
            Bills & stages
          </div>
        </Link>
        <Link
          href="/pricing"
          className="group rounded-2xl border border-zinc-800 p-5 hover:border-zinc-700"
        >
          <div className="text-sm text-zinc-400">Pro</div>
          <div className="mt-1 text-lg font-medium text-zinc-100 group-hover:text-emerald-300">
            Upgrade for alerts
          </div>
        </Link>
      </section>

      {/* Footer line */}
      <footer className="mt-16 border-t border-zinc-900/70 pt-6 text-sm text-zinc-500">
        © {new Date().getFullYear()} Verity — Built for Australians
      </footer>
    </main>
  );
}
