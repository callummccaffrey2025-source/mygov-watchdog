import Link from "next/link";

export default function HomePage() {
  return (
    <main className="p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold text-white">Verity</h1>
        <p className="text-zinc-400 max-w-xl">
          Track real legislation. No spin. Just what your government is doing.
        </p>
      </header>

      <nav className="space-y-2 text-emerald-400">
        <div>
          <Link className="hover:underline" href="/legislation">
            Browse legislation →
          </Link>
        </div>
        <div>
          <Link className="hover:underline" href="/news">
            Latest news →
          </Link>
        </div>
      </nav>

      <section className="text-zinc-500 text-sm max-w-xl leading-relaxed">
        <p>
          Verity summarizes bills into plain English and shows you who’s pushing them.
          Soon: MP profiles, voting records, alerts.
        </p>
      </section>
    </main>
  );
}
