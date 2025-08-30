import Link from "next/link";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-slate-600">
      {children}
    </span>
  );
}

function FeatureCard({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-6 shadow-sm transition hover:shadow-md">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
        {icon ?? <span className="text-sm">★</span>}
      </div>
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-slate-600">{desc}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-4 w-4 rounded-sm bg-slate-900" />
            Verity
          </Link>

          <nav className="hidden items-center gap-6 text-sm md:flex">
            <Link href="/search" className="text-slate-600 hover:text-slate-900">
              Search
            </Link>
            <Link href="/ask" className="text-slate-600 hover:text-slate-900">
              Ask AI
            </Link>
            <Link href="/sources" className="text-slate-600 hover:text-slate-900">
              Sources
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/account"
              className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-3xl py-14 sm:py-20">
              <div className="mb-4">
                <Pill>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Live beta
                  <span className="text-slate-400">• Australia · AI-powered political watchdog</span>
                </Pill>
              </div>

              <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
                Watch the politicians,
                <br />
                <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  so you don’t have to.
                </span>
              </h1>

              <p className="mt-5 text-lg leading-7 text-slate-600">
                Track bills, votes and speeches across Australia. Ask questions in plain English
                and get answers with verifiable sources.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/search"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-white hover:opacity-95"
                >
                  Try the Search
                </Link>
                <Link
                  href="/ask"
                  className="inline-flex items-center justify-center rounded-xl border px-5 py-3 hover:bg-slate-50"
                >
                  Ask Verity AI
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>Built with Next.js, Supabase, Pinecone.</span>
                <span>Private by default.</span>
              </div>
            </div>

            {/* trust points */}
            <div className="grid gap-4 pb-10 sm:grid-cols-3">
              <FeatureCard
                title="Real sources only"
                desc="Crawls gov sites, hansard, regulator releases, MPs and registers."
              />
              <FeatureCard
                title="Explained in plain English"
                desc="Summaries, timelines and red-flag callouts. No jargon."
              />
              <FeatureCard
                title="Audit trail"
                desc="Every claim links back to the primary source. Verify everything."
              />
            </div>
          </div>
        </section>

        {/* CAPABILITIES */}
        <section className="border-t bg-slate-50/50">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="mb-8">
              <Pill>Capabilities</Pill>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                Everything you need to hold power to account
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                title="Bill & Motion Tracker"
                desc="Follow bills from first reading to assent. Versions, amendments, votes — all in one place."
              />
              <FeatureCard
                title="Smart Alerts"
                desc="Get notified when a bill changes, hits committee, or is scheduled for debate."
              />
              <FeatureCard
                title="Ask with Sources"
                desc="Ask natural-language questions and get answers with line-item citations you can verify."
              />
              <FeatureCard
                title="Parliament & Courts"
                desc="Search hansard, gazettes, agencies and selected court bulletins with unified relevance."
              />
              <FeatureCard
                title="Member Profiles"
                desc="See offices held, voting records, committees and speeches — with contextual summaries."
              />
              <FeatureCard
                title="Vote History"
                desc="Roll calls and divisions visualised. Track party-line breaks and trends over time."
              />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="mb-8">
              <Pill>How it works</Pill>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                From the record to your screen in three steps
              </h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border p-6">
                <div className="mb-3 text-sm font-semibold text-slate-500">1 • Ingest</div>
                <p className="text-slate-700">
                  We continuously fetch parliaments, gazettes, agencies and selected courts across
                  jurisdictions.
                </p>
                <ul className="mt-4 space-y-1 text-sm text-slate-600">
                  <li>✓ Hansard, bills, notices</li>
                  <li>✓ Gazettes, agencies</li>
                  <li>✓ Selected courts</li>
                </ul>
              </div>
              <div className="rounded-2xl border p-6">
                <div className="mb-3 text-sm font-semibold text-slate-500">2 • Index</div>
                <p className="text-slate-700">
                  Documents are normalised, chunked, embedded and versioned so changes are tracked.
                </p>
                <ul className="mt-4 space-y-1 text-sm text-slate-600">
                  <li>✓ Normalise & de-duplicate</li>
                  <li>✓ Embed & version snapshots</li>
                  <li>✓ Filter by jurisdiction</li>
                </ul>
              </div>
              <div className="rounded-2xl border p-6">
                <div className="mb-3 text-sm font-semibold text-slate-500">3 • Answer</div>
                <p className="text-slate-700">
                  Ask in natural language; get concise answers with citations and links to the
                  record.
                </p>
                <ul className="mt-4 space-y-1 text-sm text-slate-600">
                  <li>✓ Natural-language queries</li>
                  <li>✓ Citations with line numbers</li>
                  <li>✓ Links to the record</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* COVERAGE */}
        <section className="border-t bg-slate-50/50">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <Pill>Coverage</Pill>
                <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                  Built for every Australian jurisdiction
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                "Commonwealth",
                "NSW",
                "VIC",
                "QLD",
                "WA",
                "SA",
                "TAS",
                "ACT",
                "NT",
              ].map((j) => (
                <span
                  key={j}
                  className="rounded-full border bg-white px-3 py-1 text-sm text-slate-700"
                >
                  {j}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="mb-8">
              <Pill>Pricing</Pill>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                Simple plans for citizens, advocates and teams
              </h2>
              <p className="mt-2 text-sm text-slate-600">Free to start. Save ~20% on annual.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Free */}
              <div className="flex flex-col rounded-2xl border p-6 shadow-sm">
                <div className="mb-2 text-sm font-semibold text-slate-500">Citizen</div>
                <div className="text-4xl font-bold">$0</div>
                <div className="text-sm text-slate-500">/ forever</div>
                <ul className="mt-4 space-y-1 text-sm text-slate-700">
                  <li>✓ Ask with citations</li>
                  <li>✓ Basic alerts</li>
                  <li>✓ 1 jurisdiction</li>
                </ul>
                <Link
                  href="/account?plan=free"
                  className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-white hover:opacity-95"
                >
                  Start free
                </Link>
              </div>

              {/* Pro */}
              <div className="flex flex-col rounded-2xl border p-6 shadow-md ring-1 ring-slate-900/5">
                <div className="mb-2 text-sm font-semibold text-blue-600">Most popular</div>
                <div className="text-4xl font-bold">$15</div>
                <div className="text-sm text-slate-500">/ mo</div>
                <ul className="mt-4 space-y-1 text-sm text-slate-700">
                  <li>✓ Everything in Free</li>
                  <li>✓ Priority indexing</li>
                  <li>✓ Advanced alert rules</li>
                  <li>✓ All jurisdictions</li>
                  <li>✓ Export & share</li>
                </ul>
                <Link
                  href="/account?plan=pro"
                  className="mt-6 inline-flex items-center justify-center rounded-xl border px-4 py-2 hover:bg-slate-50"
                >
                  Upgrade
                </Link>
              </div>

              {/* Teams */}
              <div className="flex flex-col rounded-2xl border p-6 shadow-sm">
                <div className="mb-2 text-sm font-semibold text-slate-500">Teams</div>
                <div className="text-4xl font-bold">$39</div>
                <div className="text-sm text-slate-500">/ user / mo</div>
                <ul className="mt-4 space-y-1 text-sm text-slate-700">
                  <li>✓ Shared workspaces</li>
                  <li>✓ SSO & roles</li>
                  <li>✓ Private cloud options</li>
                </ul>
                <Link
                  href="mailto:contact@verity.run?subject=Teams%20plan"
                  className="mt-6 inline-flex items-center justify-center rounded-xl border px-4 py-2 hover:bg-slate-50"
                >
                  Contact sales
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t bg-slate-50/50">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="mb-8">
              <Pill>Questions</Pill>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Everything else people ask</h2>
            </div>

            <div className="space-y-3">
              {[
                {
                  q: "Is Verity non-partisan?",
                  a: "Yes. Verity only ingests official sources and always links back to the record.",
                },
                {
                  q: "What jurisdictions are supported?",
                  a: "Commonwealth plus all states and territories. Coverage expands as sources are added.",
                },
                {
                  q: "Where does the data come from?",
                  a: "Parliamentary sites, agencies, regulators, notices and selected court bulletins.",
                },
                {
                  q: "Is my usage private?",
                  a: "Your searches and questions are not shared. Private by default.",
                },
                {
                  q: "How much does it cost?",
                  a: "Start free. Pro and Teams add collaboration, alerts and higher limits.",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border bg-white p-4 open:shadow-sm"
                >
                  <summary className="cursor-pointer list-none font-medium">
                    {item.q}
                    <span className="float-right text-slate-400 group-open:rotate-180">⌄</span>
                  </summary>
                  <p className="mt-2 text-slate-700">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="rounded-2xl bg-slate-900 px-6 py-10 text-white sm:px-10">
              <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-2xl font-bold">Ready to hold power to account?</h3>
                  <p className="mt-1 text-slate-300">
                    Open Verity now, or watch the quick demo.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/search"
                    className="rounded-xl bg-white px-4 py-2 font-medium text-slate-900 hover:opacity-90"
                  >
                    Open Verity
                  </Link>
                  <Link
                    href="/ask"
                    className="rounded-xl border border-white/30 px-4 py-2 text-white hover:bg-white/10"
                  >
                    Watch demo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-600 sm:flex-row">
          <div>© {new Date().getFullYear()} Verity</div>
          <nav className="flex flex-wrap items-center gap-4">
            <Link href="/search" className="hover:text-slate-900">
              Try the Search
            </Link>
            <Link href="/ask" className="hover:text-slate-900">
              Ask Verity AI
            </Link>
            <Link href="/crawl" className="hover:text-slate-900">
              Add Sources
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
