import Link from "next/link";
import Section from "../../components/section";
import Container from "../../components/container";
import CtaBar from "./_components/cta-bar";
import ConsentBanner from "./_components/consent-banner";

export const metadata = {
  title: "Transparency for Australia",
  description:
    "Ask questions about bills, Hansard, and media releases - with sources. Plus MP ratings, briefings, and alerts.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Verity - Transparency for Australia",
    description: "Sourced answers and briefings.",
    url: "/",
  },
};

// Local drop-in replacements for NavCard and SectionTitle
type Item = { href: string; title: string; body?: string };

function LocalNavCard({ href, title, body }: Item) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <div className="text-base font-semibold">{title}</div>
      {body ? <p className="mt-1 text-sm text-neutral-400">{body}</p> : null}
    </Link>
  );
}

function LocalSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xl font-semibold tracking-tight">{children}</h2>
  );
}

export default function HomePage() {
  const modules = [
    {
      href: "/product#ask",
      title: "Ask (AI explainer)",
      body: "Type a question and get a clear answer with citations.",
    },
    {
      href: "/product#search",
      title: "Search",
      body: "Bills, Hansard, press releases in one place.",
    },
    {
      href: "/product#alerts",
      title: "Watchlist",
      body: "Follow topics, MPs, and terms. Daily briefings.",
    },
  ] as const;

  const core = [
    { href: "/product", title: "Product", body: "Modules and how Verity works." },
    { href: "/pricing", title: "Pricing", body: "From $1/month. Compare tiers." },
    { href: "/join-waitlist", title: "Join waitlist", body: "Early access and updates." },
  ] as const;

  const solutions = [
    { href: "/solutions/citizens", title: "Citizens" },
    { href: "/solutions/journalists", title: "Journalists" },
    { href: "/solutions/advocacy", title: "Advocacy" },
    { href: "/solutions/educators", title: "Educators" },
  ] as const;

  const resources = [
    { href: "/blog", title: "Blog", body: "Product notes and research." },
    { href: "/case-studies", title: "Case studies", body: "Proof in practice." },
    { href: "/changelog", title: "Changelog", body: "What's new in Verity." },
    { href: "/compare/theyvoteforme", title: "Compare", body: "How Verity differs." },
    { href: "/download", title: "Press kit", body: "Brand assets and screenshots." },
    { href: "/roadmap", title: "Roadmap", body: "What we're building next." },
  ] as const;

  const company = [
    { href: "/trust", title: "Trust", body: "Security, privacy, methodology, uptime." },
    { href: "/integrity", title: "Integrity", body: "Ethics, conflicts, transparency." },
    { href: "/contact", title: "Contact", body: "Talk to the team." },
  ] as const;

  const legal = [
    { href: "/legal/privacy", title: "Privacy", body: "" },
    { href: "/legal/terms", title: "Terms", body: "" },
    { href: "/legal/cookies", title: "Cookies", body: "" },
  ] as const;

  return (
    <>
      <ConsentBanner />

{/* HERO */}
<div className="bg-grid">
  <Section className="pt-24 pb-14">
    <Container>
      <div className="mx-auto max-w-5xl text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold font-serif">Transparency for Australia</h1>
        <p className="mt-4 text-neutral-300">Ask about bills, Hansard, and media releases — with sources.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a href="/pricing" className="btn-primary">Start for $1</a>
          <a href="/product" className="btn-ghost">See product</a>
        </div>
      </div>
    </Container>
  </Section>
</div>

      {/* QUICK MODULES */}
      <Section>
        <Container>
          <div className="grid gap-6 md:grid-cols-3">
            {modules.map((m) => (
              <LocalNavCard key={m.title} {...m} />
            ))}
          </div>
        </Container>
      </Section>

      {/* CORE */}
      <Section>
        <Container>
          <LocalSectionTitle>Core</LocalSectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {core.map((x) => (
              <LocalNavCard key={x.title} {...x} />
            ))}
          </div>
        </Container>
      </Section>

      {/* DIRECTORY */}
      <Section>
        <Container>
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <LocalSectionTitle>Solutions</LocalSectionTitle>
              <div className="grid gap-3">
                {solutions.map((x) => (
                  <LocalNavCard key={x.title} {...x} />
                ))}
              </div>
            </div>
            <div>
              <LocalSectionTitle>Resources</LocalSectionTitle>
              <div className="grid gap-3">
                {resources.map((x) => (
                  <LocalNavCard key={x.title} {...x} />
                ))}
              </div>
            </div>
            <div>
              <LocalSectionTitle>Company &amp; Legal</LocalSectionTitle>
              <div className="grid gap-3">
                {[...company, ...legal].map((x) => (
                  <LocalNavCard key={x.title} {...x} />
                ))}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* BOTTOM CTA */}
      <Section>
        <Container>
          <div className="card p-10 text-center">
            <h2 className="text-2xl font-semibold">From $1/month</h2>
            <p className="mt-2 text-neutral-400">Radically affordable civic intelligence.</p>
            <div className="mt-6">
              <Link href="/pricing" className="btn-primary">
                View pricing
              </Link>
            </div>
          </div>
        </Container>
      </Section>

      <CtaBar />
    </>
  );
}
{/* SEE IT IN ACTION */}
<Section>
  <Container>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <a href="/product#ask" className="card card-hover p-6 block group">
        <div className="flex items-center justify-between">
          <div className="text-emerald-300 font-semibold">Ask</div>
          <span className="opacity-70 group-hover:translate-x-0.5 transition">→</span>
        </div>
        <p className="mt-2 text-neutral-300">Clear answers with citations.</p>
      </a>
      <a href="/product#search" className="card card-hover p-6 block group">
        <div className="flex items-center justify-between">
          <div className="text-emerald-300 font-semibold">Search</div>
          <span className="opacity-70 group-hover:translate-x-0.5 transition">→</span>
        </div>
        <p className="mt-2 text-neutral-300">Bills, Hansard, media—one place.</p>
      </a>
      <a href="/product#alerts" className="card card-hover p-6 block group">
        <div className="flex items-center justify-between">
          <div className="text-emerald-300 font-semibold">Alerts</div>
          <span className="opacity-70 group-hover:translate-x-0.5 transition">→</span>
        </div>
        <p className="mt-2 text-neutral-300">Watch topics, MPs, and terms.</p>
      </a>
    </div>
  </Container>
</Section>
{/* TRUST */}
<Section>
  <Container>
    <div className="grid gap-4 md:grid-cols-3">
      <div className="card p-5">
        <div className="font-semibold text-emerald-300">Citations on every claim</div>
        <p className="mt-2 text-neutral-300">Every answer links to original sources.</p>
      </div>
      <div className="card p-5">
        <div className="font-semibold text-emerald-300">Data sources listed</div>
        <p className="mt-2 text-neutral-300">Bills, Hansard, press releases, registers.</p>
      </div>
      <div className="card p-5">
        <div className="font-semibold text-emerald-300">Uptime & privacy</div>
        <p className="mt-2 text-neutral-300">Transparent status and no data sale. <a className="underline" href="/trust">Details</a></p>
      </div>
    </div>
    <div className="mt-4 text-center">
      <a className="underline text-neutral-300" href="/integrity">Learn how we verify →</a>
    </div>
  </Container>
</Section>
// inside PricingPage()
const tiers = [
  { name: "Entry", price: "$1/mo", cta: { href: "/join-waitlist", label: "Start for $1" }, features: ["Ask with citations (fair use)", "Weekly briefing", "Basic MP view"], highlight: true },
  { name: "Pro", price: "$15/mo", cta: { href: "/join-waitlist", label: "Upgrade to Pro" }, features: ["Real-time alerts", "CSV export", "Advanced filters", "Priority processing"] },
  { name: "Org", price: "Custom", cta: { href: "/contact", label: "Talk to sales" }, features: ["SSO & SLA", "API access", "Shared workspace", "Support"] },
];

