"use client";

import React from "react";

// small helper hook to format today's label like "Monday 27 Oct"
function useTodayLabel() {
  const [label, setLabel] = React.useState("");
  React.useEffect(() => {
    const d = new Date();
    const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
    const day = d.getDate();
    const month = d.toLocaleDateString(undefined, { month: "short" });
    setLabel(`${weekday} ${day} ${month}`);
  }, []);
  return label;
}

// dot for bias legend etc.
function ColorDot({ className }: { className: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${className}`}
      aria-hidden="true"
    />
  );
}

// simple pill chip
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-[13px] leading-none text-white/90">
      {children}
    </span>
  );
}

// stat number + label under it
function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-semibold text-white">{n}</div>
      <div className="mt-1 text-xs text-white/70">{label}</div>
    </div>
  );
}

// card shell (dark rounded box w/ border)
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/15 bg-white/[0.03] p-4 text-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] ${className}`}
    >
      {children}
    </div>
  );
}

// nav header (top bar)
function Header() {
  const TABS = ["Home", "Stories", "Issues", "MPs", "Sources"];

  return (
    <header className="border-b border-white/10 bg-[#0b0f12] text-white">
      {/* first row: brand + actions */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-tr from-emerald-400 via-cyan-400 to-fuchsia-400 text-[11px] font-semibold text-black shadow-[0_0_16px_rgba(16,185,129,0.6)]">
            V
          </div>
          <div className="text-[15px] font-medium leading-none text-white">
            Verity
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 text-[13px]">
          <button className="rounded-md border border-white/20 bg-white/[0.05] px-3 py-1.5 text-white/90 hover:bg-white/[0.08]">
            How it works
          </button>
          <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-500">
            Start free
          </button>
        </div>
      </div>

      {/* second row: tabs */}
      <div className="mx-auto max-w-6xl px-4 pb-3">
        <div className="flex w-full flex-wrap items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] p-1 text-[13px]">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              className={`rounded-md px-3 py-1.5 ${
                i === 0
                  ? "bg-white/[0.07] text-white ring-1 ring-white/20"
                  : "text-white/80 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

// bars: left/centre/right %
function BiasBarRow({
  label,
  colorClass,
  value,
}: {
  label: string;
  colorClass: string;
  value: number;
}) {
  return (
    <div className="mt-2 text-[13px] text-white/90">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-1 h-[6px] w-full rounded bg-white/10">
        <div
          className={`h-[6px] rounded ${colorClass}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// testimonial bubble with initials
function Testimonial({
  name,
  quote,
}: {
  name: string;
  quote: string;
}) {
  const initials = name
    .split("—")[0]
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <Card className="flex flex-col gap-2 bg-white/[0.02]">
      <div className="flex items-start gap-3 text-[13px] text-white/80">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] text-white/80">
          {initials}
        </div>
        <div className="flex-1">
          <div className="text-[13px] text-white/80">{name}</div>
          <div className="mt-1 text-[14px] leading-relaxed text-white">
            “{quote}”
          </div>
        </div>
      </div>
    </Card>
  );
}

// ------------------------------
// PAGE
// ------------------------------
export default function Page() {
  const today = useTodayLabel();

  // data blobs
  const PROBLEMS = [
    {
      icon: "🧭",
      title: "Media bias",
      body: "Most outlets push a side. Verity shows them all together.",
    },
    {
      icon: "🌀",
      title: "Information overload",
      body: "You shouldn’t need 10 tabs. We summarise what matters.",
    },
    {
      icon: "🎭",
      title: "Political spin",
      body: "We expose the language tricks so you can see reality.",
    },
  ];

  const STEPS = [
    {
      n: 1,
      title: "Scan",
      body: "We read major news and Parliament records around the clock.",
    },
    {
      n: 2,
      title: "Compare",
      body: "We line up left, centre, and right on the same topic.",
    },
    {
      n: 3,
      title: "Reveal",
      body: "We show you the balanced picture — with sources & timestamps.",
    },
  ];

  const TESTIMONIALS = [
    {
      name: "Jack — Sydney",
      quote:
        "The only news app that actually calms me down. I feel informed, not angry.",
    },
    {
      name: "Sarah — Perth",
      quote:
        "I stopped doomscrolling. The balance bar is a game-changer.",
    },
    {
      name: "Anita — Brisbane",
      quote:
        "I finally understand what’s going on without picking a side.",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#0b0f12] text-white">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* HERO */}
        <section className="text-center">
          <h1 className="mx-auto max-w-3xl text-[32px] font-semibold leading-[1.15] tracking-tight text-white md:text-[40px]">
            Finally — the news you can actually{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
              trust.
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/80">
            We show how every side of politics covers the same issue — so you
            can see truth, not spin. Balanced. Verified. Calm.
          </p>

          {/* CTA row */}
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-[14px]">
            <button className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white shadow-[0_20px_40px_-10px_rgba(16,185,129,0.6)] hover:bg-emerald-500">
              See today’s stories — {today || "Today"}
            </button>
            <button className="rounded-md border border-white/20 bg-white/[0.05] px-4 py-2 text-white/90 hover:bg-white/[0.08]">
              Join the waitlist
            </button>
          </div>

          {/* balance + bias chip */}
          <div className="mt-6 text-[13px] text-white/70">
            Balanced view from verified sources.
          </div>

          <div className="mt-3 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[13px] text-emerald-200">
              <span className="inline-block h-[6px] w-[6px] rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,.7)]" />
              <span className="text-white">
                Today’s bias: <span className="text-white">Centre</span> 42%
              </span>
            </div>
          </div>

          {/* feature pills */}
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-[13px] text-white/90">
            <Pill>No outrage design</Pill>
            <Pill>Verified sources</Pill>
            <Pill>Bias transparency</Pill>
            <Pill>Privacy-respecting</Pill>
          </div>

          {/* stats */}
          <div className="mt-10 flex flex-wrap justify-center gap-10 text-white/90">
            <Stat n="1.2k" label="topics monitored" />
            <Stat n="88%" label="AI validation rate" />
            <Stat n="24h" label="momentum tracking" />
          </div>
        </section>

        {/* FEATURE CARDS */}
        <section className="mt-10">
          <div className="rounded-xl border border-white/15 bg-white/[0.02] p-4">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Card 1 */}
              <Card className="bg-white/[0.03]">
                <div className="h-20 w-full rounded-md bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,.2),transparent_60%),radial-gradient(circle_at_100%_0%,rgba(56,189,248,.2),transparent_60%)]" />
                <div className="mt-4 text-[15px] font-medium text-white">
                  Compare sources
                </div>
                <div className="mt-1 text-[13px] leading-relaxed text-white/80">
                  Left, centre, right — lined up side by side.
                </div>

                {/* mini bars */}
                <div className="mt-3 space-y-2 text-[12px] text-white/80">
                  <div className="h-[6px] w-full rounded bg-white/10">
                    <div
                      className="h-[6px] rounded bg-rose-400"
                      style={{ width: "34%" }}
                    />
                  </div>
                  <div className="h-[6px] w-full rounded bg-white/10">
                    <div
                      className="h-[6px] rounded bg-emerald-400"
                      style={{ width: "46%" }}
                    />
                  </div>
                  <div className="h-[6px] w-full rounded bg-white/10">
                    <div
                      className="h-[6px] rounded bg-amber-400"
                      style={{ width: "20%" }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-white/70">
                  <ColorDot className="bg-rose-400" />
                  <span>Left</span>
                  <ColorDot className="bg-emerald-400" />
                  <span>Centre</span>
                  <ColorDot className="bg-amber-400" />
                  <span>Right</span>
                </div>

                <button className="mt-4 rounded-md border border-white/20 bg-white/[0.05] px-3 py-1.5 text-[12px] text-white/90 hover:bg-white/[0.08]">
                  Open demo
                </button>
              </Card>

              {/* Card 2 */}
              <Card className="bg-white/[0.03]">
                <div className="h-20 w-full rounded-md bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,.2),transparent_60%),radial-gradient(circle_at_100%_0%,rgba(56,189,248,.2),transparent_60%)]" />
                <div className="mt-4 text-[15px] font-medium text-white">
                  Track momentum
                </div>
                <div className="mt-1 text-[13px] leading-relaxed text-white/80">
                  See how narratives rise and fall through the day.
                </div>

                {/* mini bars */}
                <div className="mt-3 space-y-2 text-[12px] text-white/80">
                  <div className="h-[6px] w-full rounded bg-white/10">
                    <div
                      className="h-[6px] rounded bg-rose-400"
                      style={{ width: "28%" }}
                    />
                  </div>
                  <div className="h-[6px] w-full rounded bg-white/10">
                    <div
                      className="h-[6px] rounded bg-emerald-400"
                      style={{ width: "54%" }}
                    />
                  </div>
                  <div className="h-[6px] w-full rounded bg-white/10">
                    <div
                      className="h-[6px] rounded bg-amber-400"
                      style={{ width: "18%" }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-white/70">
                  <ColorDot className="bg-rose-400" />
                  <span>Left</span>
                  <ColorDot className="bg-emerald-400" />
                  <span>Centre</span>
                  <ColorDot className="bg-amber-400" />
                  <span>Right</span>
                </div>

                <button className="mt-4 rounded-md border border-white/20 bg-white/[0.05] px-3 py-1.5 text-[12px] text-white/90 hover:bg-white/[0.08]">
                  View chart
                </button>
              </Card>

              {/* Card 3 */}
              <Card className="bg-white/[0.03]">
                <div className="h-20 w-full rounded-md bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,.2),transparent_60%),radial-gradient(circle_at_100%_0%,rgba(56,189,248,.2),transparent_60%)]" />
                <div className="mt-4 text-[15px] font-medium text-white">
                  Verify claims
                </div>
                <div className="mt-1 text-[13px] leading-relaxed text-white/80">
                  Summaries with citations and timestamps.
                </div>

                {/* mini bars */}
                <div className="mt-3 space-y-2 text-[12px] text-white/80">
                  <div className="h-[6px] w-full rounded bg-white/10">
                    <div
                      className="h-[6px] rounded bg-rose-400"
                      style={{ width: "22%" }}
                    />
                  </div>
                  <div className="h-[6px] w-full rounded bg-white/10">
                    <div
                      className="h-[6px] rounded bg-emerald-400"
                      style={{ width: "61%" }}
                    />
                  </div>
                  <div className="h-[6px] w-full rounded bg-white/10">
                    <div
                      className="h-[6px] rounded bg-amber-400"
                      style={{ width: "17%" }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-white/70">
                  <ColorDot className="bg-rose-400" />
                  <span>Left</span>
                  <ColorDot className="bg-emerald-400" />
                  <span>Centre</span>
                  <ColorDot className="bg-amber-400" />
                  <span>Right</span>
                </div>

                <button className="mt-4 rounded-md border border-white/20 bg-white/[0.05] px-3 py-1.5 text-[12px] text-white/90 hover:bg-white/[0.08]">
                  See sources
                </button>
              </Card>
            </div>
          </div>
        </section>

        {/* WHAT'S BROKEN */}
        <section className="mt-12 text-white">
          <div className="text-center text-[11px] font-medium uppercase tracking-widest text-white/50">
            What’s broken
          </div>
          <h2 className="mt-2 text-center text-[24px] font-semibold leading-[1.2] tracking-tight text-white md:text-[28px]">
            News shouldn’t make you angry or confused.
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PROBLEMS.map((p) => (
              <Card
                key={p.title}
                className="flex flex-col bg-white/[0.02] text-white"
              >
                <div className="text-2xl">{p.icon}</div>
                <div className="mt-3 text-[15px] font-medium text-white">
                  {p.title}
                </div>
                <div className="mt-1 text-[13px] leading-relaxed text-white/80">
                  {p.body}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* HOW VERITY WORKS */}
        <section className="mt-12 text-white">
          <div className="text-center text-[11px] font-medium uppercase tracking-widest text-white/50">
            How Verity works
          </div>
          <h2 className="mt-2 text-center text-[24px] font-semibold leading-[1.2] tracking-tight text-white md:text-[28px]">
            Simple steps. Clear results.
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <Card
                key={s.n}
                className="flex flex-col bg-white/[0.02] text-white"
              >
                <div className="text-[13px] text-white/70">Step {s.n}</div>
                <div className="mt-2 text-[15px] font-medium text-white">
                  {s.title}
                </div>
                <div className="mt-1 text-[13px] leading-relaxed text-white/80">
                  {s.body}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* TODAY'S EXAMPLE */}
        <section className="mt-12 text-white">
          <div className="grid gap-4 md:grid-cols-2">
            {/* left side: bars */}
            <Card className="bg-white/[0.02] text-white">
              <div className="text-[12px] text-white/70">Today’s example</div>
              <div className="mt-2 text-[15px] font-medium text-white">
                Energy Debate
              </div>
              <div className="mt-1 text-[13px] leading-relaxed text-white/80">
                See how different sides talk about the same problem. We pull
                quotes and headlines, then show the balance clearly.
              </div>

              <BiasBarRow
                label="Left"
                colorClass="bg-rose-400"
                value={34}
              />
              <BiasBarRow
                label="Centre"
                colorClass="bg-emerald-400"
                value={46}
              />
              <BiasBarRow
                label="Right"
                colorClass="bg-amber-400"
                value={20}
              />
            </Card>

            {/* right side: snapshot bullets */}
            <Card className="bg-white/[0.02] text-white">
              <div className="text-[12px] font-medium text-white/70">
                Balanced snapshot
              </div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-white/80">
                <li>Rents rose faster than wages in 8/10 regions.</li>
                <li>
                  Builders warn supply bottlenecks; approvals down 12%.
                </li>
                <li>Targeted incentives gain crossbench interest.</li>
              </ul>
            </Card>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="mt-12 text-white">
          <div className="text-center text-[11px] font-medium uppercase tracking-widest text-white/50">
            What people say
          </div>
          <h2 className="mt-2 text-center text-[24px] font-semibold leading-[1.2] tracking-tight text-white md:text-[28px]">
            It feels calm, honest, and useful.
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Testimonial
                key={t.name}
                name={t.name}
                quote={t.quote}
              />
            ))}
          </div>

          {/* trust bar */}
          <div className="mt-6 rounded-xl border border-white/15 bg-white/[0.02] p-4 text-center text-[13px] leading-relaxed text-white/70">
            Supported by Australians — not advertisers. Verity never
            personalises or tracks your reading.
          </div>
        </section>

        {/* FOOTER CTA */}
        <footer className="mt-12 text-white">
          <div className="rounded-xl border border-white/15 bg-white/[0.02] p-6 text-center">
            <div className="text-[18px] font-semibold text-white">
              Join Australians who want to see clearly.
            </div>
            <div className="mt-1 text-[13px] leading-relaxed text-white/80">
              Start free in under a minute. No credit card.
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[14px]">
              <button className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white shadow-[0_20px_40px_-10px_rgba(16,185,129,0.6)] hover:bg-emerald-500">
                Start free
              </button>
              <button className="rounded-md border border-white/20 bg-white/[0.05] px-4 py-2 text-white/90 hover:bg-white/[0.08]">
                Contact us
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-[12px] text-white/60">
            © Verity — See truth, not spin.
          </div>
        </footer>
      </main>

      {/* sticky CTA bottom-right */}
      <button className="fixed bottom-5 right-5 z-40 rounded-md bg-emerald-600 px-4 py-2 text-[14px] font-medium text-white shadow-[0_20px_40px_-10px_rgba(16,185,129,0.6)] hover:bg-emerald-500">
        See today’s stories
      </button>
    </div>
  );
}
