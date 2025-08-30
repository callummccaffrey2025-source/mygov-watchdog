import Link from "next/link";
import { Shield, Bell, Landmark, Search, Users, Vote, Check } from "lucide-react";

export const metadata = {
  title: "Verity — AI-powered political watchdog for Australia",
  description:
    "Search bills, votes and speeches. Ask questions with citations you can verify.",
};

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="card card-hover p-5">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
        {icon}
      </div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-sm text-zinc-600">{text}</p>
    </div>
  );
}

function Step({ n, title, points }: { n: number; title: string; points: string[] }) {
  return (
    <li className="card p-5">
      <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{n}</div>
      <h4 className="mb-2 font-semibold">{title}</h4>
      <ul className="space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-zinc-700">
            <Check className="mt-0.5 h-4 w-4" /> {p}
          </li>
        ))}
      </ul>
    </li>
  );
}

function Card({ title, text }: { title: string; text: string }) {
  return (
    <div className="card p-5">
      <h4 className="mb-1 font-semibold">{title}</h4>
      <p className="text-sm text-zinc-600">{text}</p>
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="bg-hero">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-6"><span className="badge">Australia · AI-powered political watchdog</span></div>
          <h1 className="max-w-3xl text-5xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl">
            Watch the politicians,<br />
            <span className="text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">
              so you don’t have to
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-600">
            Track bills, votes and speeches across Australia. Ask questions in plain
            English and get answers with verifiable sources.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/search" className="rounded-lg bg-zinc-900 px-4 py-2 text-white">Try the app</Link>
            <Link href="/ask" className="rounded-lg border px-4 py-2 text-zinc-900">Live search</Link>
            <Link href="/demo" className="rounded-lg border px-4 py-2 text-zinc-900">See a 90-sec demo</Link>
          </div>
          <form action="/ask" className="mt-8 max-w-xl rounded-xl border bg-white p-2 shadow-sm">
            <input name="q" placeholder="Ask anything (e.g., What changed in the NSW Bail Act in 2024?)" className="w-full rounded-lg px-3 py-2 outline-none" />
          </form>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-600">
            <div className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" />Live beta</div>
            <span>Non-partisan</span><span>Cited answers</span><span>All jurisdictions</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-semibold">Everything you need to hold power to account</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Feature icon={<Search />} title="Ask with Sources" text="Ask natural-language questions and get answers with line-item citations you can verify." />
          <Feature icon={<Bell />} title="Smart Alerts" text="Get notified when a bill changes, hits committee, or is scheduled for debate." />
          <Feature icon={<Landmark />} title="Parliament & Courts" text="Search Hansard, gazettes, agencies, and selected court bulletins with unified relevance." />
          <Feature icon={<Users />} title="Member Profiles" text="See offices held, voting records, committees, speeches — with contextual summaries." />
          <Feature icon={<Vote />} title="Vote History" text="Roll calls & divisions visualised. Track party-line breaks and trends over time." />
          <Feature icon={<Shield />} title="Audit trail" text="Every answer links to the record; documents are versioned to track changes over time." />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-semibold">From the record to your screen in three steps</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          <Step n={1} title="Ingest" points={["Hansard, bills, notices", "Gazettes, agencies", "Selected courts"]} />
          <Step n={2} title="Index" points={["Normalise & deduplicate", "Embed & snapshot versions", "Filter by jurisdiction"]} />
          <Step n={3} title="Answer" points={["Natural-language queries", "Citations with line numbers", "Links to the record"]} />
        </ol>
      </section>

      {/* SECURITY */}
      <section id="security" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-semibold">Security, privacy, and governance</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Account & Auth" text="Email magic links / SSO for teams. Role-based access controls in app." />
          <Card title="Data Handling" text="Minimal PII; source documents stored with checksums & version history." />
          <Card title="Infrastructure" text="Isolated environments, regional hosting options, daily backups." />
          <Card title="Compliance" text="GDPR-style export/delete; enterprise DPA; private cloud options." />
        </div>
      </section>

      {/* COVERAGE */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-semibold">Built for every Australian jurisdiction</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {["Commonwealth","NSW","VIC","QLD","WA","SA","TAS","ACT","NT"].map((j)=>(
            <span key={j} className="badge">{j}</span>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-semibold">Simple plans for citizens, advocates, and teams</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-6">
            <h3 className="text-lg font-semibold">Citizen</h3>
            <p className="mt-1 text-sm text-zinc-600">For staying informed.</p>
            <div className="my-4 text-4xl font-bold">$0 <span className="text-base font-normal">/ forever</span></div>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li className="flex items-start gap-2"><Check className="h-4 w-4" /> Ask with citations</li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4" /> Basic alerts</li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4" /> 1 jurisdiction</li>
            </ul>
            <Link href="/account" className="mt-6 inline-flex w-full justify-center rounded-lg bg-zinc-900 px-4 py-2 text-white">Start free</Link>
          </div>
          <div className="card p-6 ring-2 ring-zinc-900">
            <div className="mb-2 inline-block rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">Most Popular</div>
            <h3 className="text-lg font-semibold">Pro</h3>
            <p className="mt-1 text-sm text-zinc-600">For power users and advocates.</p>
            <div className="my-4 text-4xl font-bold">$15 <span className="text-base font-normal">/mo</span></div>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li className="flex items-start gap-2"><Check className="h-4 w-4" /> Priority indexing</li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4" /> Advanced alert rules</li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4" /> All jurisdictions</li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4" /> Export & share</li>
            </ul>
            <Link href="/upgrade" className="mt-6 inline-flex w-full justify-center rounded-lg border px-4 py-2">Upgrade</Link>
          </div>
          <div className="card p-6">
            <h3 className="text-lg font-semibold">Teams</h3>
            <p className="mt-1 text-sm text-zinc-600">For orgs, media, and research.</p>
            <div className="my-4 text-4xl font-bold">$39 <span className="text-base font-normal">/user/mo</span></div>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li className="flex items-start gap-2"><Check className="h-4 w-4" /> Shared workspaces</li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4" /> SSO & roles</li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4" /> Private cloud options</li>
            </ul>
            <Link href="/contact" className="mt-6 inline-flex w-full justify-center rounded-lg border px-4 py-2">Contact sales</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-semibold">Everything else people ask</h2>
        <div className="space-y-3">
          {[
            ["Is Verity non-partisan?","Yes. We index the public record and show citations for every answer."],
            ["What jurisdictions are supported?","Commonwealth + every state/territory; coverage varies per source."],
            ["Where does the data come from?","Hansard, legislation, gazettes, agencies, and selected courts."],
            ["Is my usage private?","We store minimal PII and don’t sell data. See Privacy for details."],
            ["How much does it cost?","Citizen is free. Pro and Teams add collaboration & scale."],
          ].map(([q,a])=>(
            <details key={q} className="card p-4">
              <summary className="cursor-pointer list-none font-medium">{q}</summary>
              <p className="mt-2 text-sm text-zinc-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="card flex flex-col items-center justify-between gap-6 p-6 sm:flex-row">
          <div>
            <h3 className="text-lg font-semibold">Ready to hold power to account?</h3>
            <p className="mt-1 text-sm text-zinc-600">Join the waitlist for early access, or jump into the live demo.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/ask" className="rounded-lg bg-zinc-900 px-4 py-2 text-white">Open Verity</Link>
            <Link href="/demo" className="rounded-lg border px-4 py-2">Watch demo</Link>
          </div>
        </div>
      </section>
    </>
  );
}
