import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-20 bg-white/70 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-slate-900" />
            <span className="font-semibold tracking-tight">Verity</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm">
            <Link href="/search" className="hover:opacity-80">Search</Link>
            <Link href="/ask" className="hover:opacity-80">Ask AI</Link>
            <Link href="/crawl" className="hover:opacity-80">Sources</Link>
            <Link
              href="/account"
              className="rounded-xl border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Live beta
            </div>
            <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight">
              AI-powered political watchdog for Australia.
            </h1>
            <p className="mt-4 text-slate-600 text-lg">
              Verity crawls official sources, tracks bills, and explains what
              actually changes your life—without the spin. Search everything.
              Ask anything. Stay free.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/search"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-white hover:opacity-90"
              >
                Try the Search
              </Link>
              <Link
                href="/ask"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 hover:bg-white"
              >
                Ask Verity AI
              </Link>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Built with Next.js, Supabase, Pinecone. Private by default.
            </p>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold">Real sources only</h3>
            <p className="mt-2 text-sm text-slate-600">
              Crawls gov sites, hansard, regulator releases, MP pages, registers.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold">Explained in plain English</h3>
            <p className="mt-2 text-sm text-slate-600">
              Summaries, timelines, and red-flag callouts. No jargon.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold">Audit trail</h3>
            <p className="mt-2 text-sm text-slate-600">
              Every claim links back to the primary source. Verify everything.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">How Verity works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {[
              ["1. Crawl", "Fetch from official sources on schedule."],
              ["2. Index", "Clean, de-dup, embed to vector search."],
              ["3. Answer", "RAG over trusted context, cite sources."],
              ["4. Watch", "Re-index changes, alert you to updates."],
            ].map(([title, desc], i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-xs text-slate-500">Step {i + 1}</div>
                <div className="mt-1 font-medium">{title}</div>
                <p className="mt-2 text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-semibold">Get started now</h3>
            <p className="mt-1 text-sm text-slate-600">
              Search the record, ask a question, or add your first source.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/crawl"
              className="rounded-xl border border-slate-300 px-4 py-2.5 hover:bg-slate-50"
            >
              Add Sources
            </Link>
            <Link
              href="/search"
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-white hover:opacity-90"
            >
              Start Searching
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Verity</span>
          <div className="flex items-center gap-4">
            <Link href="/account" className="hover:opacity-80">Account</Link>
            <Link href="/ask" className="hover:opacity-80">AI</Link>
            <a
              className="hover:opacity-80"
              href="mailto:founder@useverity.app"
              rel="noopener noreferrer"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
