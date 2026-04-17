// src/app/mps/[id]/page.tsx
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Mail, Phone, MapPin, Landmark, Users, Newspaper, Vote as VoteIcon, Shield, Share2 } from "lucide-react";
import { clsx } from "clsx";

// ==== tiny utilities ====
const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/,"");
const abs = (p: string) => new URL(p, base).toString();

type MP = {
  id: string;
  slug?: string;
  name: string;
  party: string;
  state?: string;
  electorate?: string;
  roles?: string[];
  committees?: { name: string; href?: string }[];
  portfolios?: string[];
  history?: { title: string; from?: string; to?: string }[];
  contact?: {
    email?: string;
    phone?: string;
    electorateOffice?: string;
    parliamentOffice?: string;
  };
  images?: {
    portrait?: string;      // official headshot
    partyLogo?: string;     // party logo
  };
  // Optional stances summary if you’ve precomputed
  stances?: string[];
};

type VoteRow = { billId: string; billTitle: string; stage?: string; date?: string; vote: "Aye" | "No" | "Abstain" };
type NewsItem = { id: string; title: string; href: string; date?: string };

// ==== data loaders (edge-friendly; adjust paths to your APIs) ====
async function getMP(id: string): Promise<MP | null> {
  const r = await fetch(abs(`/api/mps/${encodeURIComponent(id)}`), { cache: "no-store" });
  if (!r.ok) return null;
  return r.json();
}

async function getVotes(id: string, page = 1): Promise<{ items: VoteRow[]; nextPage?: number }> {
  // If you have a real endpoint, replace with it. Here we infer from /api/mps/[id] or return demo data.
  const r = await fetch(abs(`/api/mps/${encodeURIComponent(id)}`), { cache: "no-store" });
  if (!r.ok) return { items: [] };
  const mp = (await r.json()) as any;
  const items: VoteRow[] = (mp?.votes || []).map((v: any) => ({
    billId: v.id || v.billId || "unknown",
    billTitle: v.title || v.billTitle || "Unknown bill",
    stage: v.stage || "—",
    date: v.date || v.when || "",
    vote: (v.vote || "Abstain") as VoteRow["vote"],
  }));
  const pageSize = 20;
  const slice = items.slice((page - 1) * pageSize, page * pageSize);
  return { items: slice, nextPage: items.length > page * pageSize ? page + 1 : undefined };
}

async function getNewsForMP(mpName: string, page = 1): Promise<{ items: NewsItem[]; nextPage?: number }> {
  // Call your /api/news and filter client-side for mentions of this MP
  const r = await fetch(abs(`/api/news`), { cache: "no-store" });
  if (!r.ok) return { items: [] };
  const j = await r.json();
  const all: NewsItem[] = (j.items || [])
    .filter((n: any) => (n.title || "").toLowerCase().includes(mpName.toLowerCase()))
    .map((n: any) => ({ id: n.id || n.slug || n.url, title: n.title, href: n.url || abs(`/news/${n.id || n.slug}`), date: n.date }));
  const pageSize = 10;
  const slice = all.slice((page - 1) * pageSize, page * pageSize);
  return { items: slice, nextPage: all.length > page * pageSize ? page + 1 : undefined };
}

// ==== SEO ====
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const mp = await getMP(params.id);
  if (!mp) return { title: "MP Profile — Not found" };
  const title = `${mp.name} — ${mp.party} (${mp.state || "AU"})`;
  const description = [
    mp.electorate ? `Electorate: ${mp.electorate}` : null,
    mp.roles?.length ? `Current roles: ${mp.roles.join(", ")}` : null,
  ].filter(Boolean).join(" • ") || `Profile of ${mp.name}`;
  const image = mp.images?.portrait || mp.images?.partyLogo;
  return {
    title,
    description,
    openGraph: {
      title, description,
      images: image ? [{ url: image }] : undefined,
      url: abs(`/mps/${mp.slug || params.id}`),
      type: "profile",
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

// ==== Page ====
export default async function Page({ params, searchParams }: { params: { id: string }, searchParams: Record<string,string|undefined> }) {
  const mp = await getMP(params.id);
  if (!mp) return notFound();

  const tab = (searchParams.tab || "profile") as "profile" | "roles" | "votes" | "news" | "donations";

  return (
    <main className="mx-auto max-w-4xl px-4 md:px-6 py-8">
      <Header mp={mp} />
      <Tabs current={tab} id={mp.slug || params.id} />

      {/* TABS CONTENT */}
      {tab === "profile" && <ProfileTab mp={mp} />}
      {tab === "roles" && <RolesTab mp={mp} />}
      {tab === "votes" && (
        <Suspense fallback={<Section title="Votes"><div className="text-sm opacity-70">Loading votes…</div></Section>}>
          {/* @ts-expect-error Async Server Component */}
          <VotesTab id={mp.slug || params.id} />
        </Suspense>
      )}
      {tab === "news" && (
        <Suspense fallback={<Section title="Recent news"><div className="text-sm opacity-70">Loading news…</div></Section>}>
          {/* @ts-expect-error Async Server Component */}
          <NewsTab name={mp.name} />
        </Suspense>
      )}
      {tab === "donations" && (
        <Section title="Donations / Interests">
          <p className="text-sm opacity-70">Coming soon.</p>
        </Section>
      )}
    </main>
  );
}

// ==== Header with portrait + party logo ====
function Header({ mp }: { mp: MP }) {
  return (
    <header className="mb-6">
      <div className="flex items-start gap-4">
        <div className="relative">
          <img
            src={mp.images?.portrait || "/placeholder-avatar.png"}
            alt={`${mp.name} portrait`}
            className="h-20 w-20 rounded-xl object-cover ring-1 ring-white/10"
          />
          {mp.images?.partyLogo && (
            <img
              src={mp.images.partyLogo}
              alt={`${mp.party} logo`}
              className="absolute -bottom-2 -right-2 h-8 w-8 rounded bg-white p-0.5 shadow"
            />
          )}
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">{mp.name}</h1>
          <p className="mt-1 text-sm md:text-base text-white/70">
            {mp.party}{mp.electorate ? ` • ${mp.electorate}` : ""}{mp.state ? ` • ${mp.state}` : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <ShareButton url={abs(`/mps/${mp.slug || mp.id}`)} label={`Share ${mp.name}`} />
          </div>
        </div>
      </div>
    </header>
  );
}

function ShareButton({ url, label }: { url: string; label: string }) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:border-white/25"
      aria-label={label}
      onClick={async () => {
        try { await navigator.clipboard.writeText(url); } catch {}
      }}
    >
      <Share2 className="h-4 w-4" aria-hidden />
      Copy link
    </button>
  );
}

// ==== Tabs ====
function Tabs({ current, id }: { current: string; id: string }) {
  const tabs = [
    { key: "profile", label: "Profile" },
    { key: "roles", label: "Roles" },
    { key: "votes", label: "Votes" },
    { key: "news", label: "News mentions" },
    { key: "donations", label: "Donations / Interests", disabled: true },
  ] as const;

  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Profile sections">
      {tabs.map(t => (
        <a
          key={t.key}
          aria-disabled={t.disabled}
          href={t.disabled ? undefined : `/mps/${id}?tab=${t.key}`}
          className={clsx(
            "rounded-full px-3 py-1.5 text-sm border",
            current === t.key ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 hover:border-white/20",
            t.disabled && "pointer-events-none opacity-40"
          )}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}

// ==== Profile tab: contact + stances + electorate ====
function ProfileTab({ mp }: { mp: MP }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Section title="Current roles" icon={<Users className="h-4 w-4" aria-hidden />}>
        {mp.roles?.length ? (
          <ul className="space-y-1 text-sm">
            {mp.roles.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        ) : <Empty text="No current roles recorded." />}
      </Section>

      <Section title="Contact" icon={<Shield className="h-4 w-4" aria-hidden />}>
        <LabeledItem icon={<Mail className="h-4 w-4" aria-hidden />} label="Email" value={mp.contact?.email} />
        <LabeledItem icon={<Phone className="h-4 w-4" aria-hidden />} label="Phone" value={mp.contact?.phone} />
      </Section>

      <Section title="Offices" icon={<Landmark className="h-4 w-4" aria-hidden />}>
        <LabeledItem icon={<MapPin className="h-4 w-4" aria-hidden />} label="Electorate Office" value={mp.contact?.electorateOffice} />
        <LabeledItem icon={<MapPin className="h-4 w-4" aria-hidden />} label="Parliament House" value={mp.contact?.parliamentOffice} />
      </Section>

      <Section className="md:col-span-2" title="Stances / positions" icon={<VoteIcon className="h-4 w-4" aria-hidden />}>
        <StancesList stances={mp.stances} />
      </Section>

      <Section title={`Electorate${mp.electorate ? ` — ${mp.electorate}` : ""}`} icon={<MapPin className="h-4 w-4" aria-hidden />}>
        <div className="space-y-3">
          <div className="aspect-[16/10] rounded-lg bg-black/20 ring-1 ring-white/10 flex items-center justify-center text-xs text-white/60">
            Electorate map placeholder
          </div>
          <ul className="text-sm space-y-1">
            <li><strong>Population:</strong> n/a</li>
            <li><strong>Top industries:</strong> n/a</li>
          </ul>
        </div>
      </Section>
    </div>
  );
}

function StancesList({ stances }: { stances?: string[] }) {
  const items = stances && stances.length ? stances : ["No stance summary yet."];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s, i) => (
        <span key={i} className="rounded-full border border-white/10 px-2 py-1 text-xs">{s}</span>
      ))}
    </div>
  );
}

// ==== Roles tab (committees + portfolios + history) ====
function RolesTab({ mp }: { mp: MP }) {
  return (
    <div className="space-y-4">
      <Section title="Committees">
        {mp.committees?.length ? (
          <ul className="list-disc pl-5 text-sm space-y-1">
            {mp.committees.map((c, i) => (
              <li key={i}>
                {c.href ? <a className="underline hover:no-underline" href={c.href} target="_blank" rel="noreferrer">{c.name}</a> : c.name}
              </li>
            ))}
          </ul>
        ) : <Empty text="No committee memberships listed." />}
      </Section>

      <Section title="Ministerial portfolios">
        {mp.portfolios?.length ? (
          <ul className="list-disc pl-5 text-sm space-y-1">
            {mp.portfolios.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        ) : <Empty text="No current portfolios." />}
      </Section>

      <Section title="Historical roles">
        {mp.history?.length ? (
          <ul className="relative mt-1 space-y-4">
            {mp.history.map((h, i) => (
              <li key={i} className="grid grid-cols-[auto,1fr] gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-white/60" aria-hidden />
                <div className="text-sm">
                  <div className="font-medium">{h.title}</div>
                  <div className="text-white/60">{h.from || "—"} — {h.to || "present"}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty text="No past positions recorded." />}
      </Section>
    </div>
  );
}

// ==== Votes tab (async server component) ====
async function VotesTab({ id }: { id: string }) {
  const { items } = await getVotes(id, 1);
  return (
    <Section title="Voting history">
      {items.length ? <VotesTable rows={items} /> : <Empty text="No recent votes recorded." />}
    </Section>
  );
}

function VotesTable({ rows }: { rows: VoteRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-white/70">
          <tr className="[&>th]:py-2 [&>th]:pr-4">
            <th>Bill</th><th>Stage</th><th>Date</th><th>Vote</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((r, i) => (
            <tr key={i} className="[&>td]:py-2 [&>td]:pr-4 align-top">
              <td>
                <a className="underline hover:no-underline" href={`/legislation/${encodeURIComponent(r.billId)}`}>{r.billTitle}</a>
              </td>
              <td>{r.stage || "—"}</td>
              <td>{r.date || "—"}</td>
              <td>
                <span className={clsx(
                  "rounded-full px-2 py-0.5 text-xs",
                  r.vote === "Aye" && "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30",
                  r.vote === "No" && "bg-red-500/20 text-red-300 ring-1 ring-red-500/30",
                  r.vote === "Abstain" && "bg-zinc-500/20 text-zinc-300 ring-1 ring-white/10"
                )}>
                  {r.vote}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==== News tab (async server component) ====
async function NewsTab({ name }: { name: string }) {
  const { items } = await getNewsForMP(name, 1);
  return (
    <Section title="Recent news">
      {items.length ? (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="text-sm">
              <a className="underline hover:no-underline" href={n.href} target={/^https?:\/\//.test(n.href) ? "_blank" : undefined} rel="noreferrer">
                {n.title}
              </a>
              {n.date && <span className="ml-2 text-white/50">{n.date}</span>}
            </li>
          ))}
        </ul>
      ) : <Empty text="No recent mentions." />}
    </Section>
  );
}

// ==== primitives ====
function Section({ title, icon, children, className }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-xl border border-white/10 p-4", className)}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-medium">
        {icon}{icon && <span className="sr-only">{title}</span>}
        <span aria-hidden={!!icon}>{title}</span>
      </h2>
      {children}
    </section>
  );
}
function LabeledItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
        {icon}{icon && <span className="sr-only">{label}</span>}
        <span aria-hidden={!!icon}>{label}</span>
      </div>
      <div className="mt-1 text-sm">{value || <span className="opacity-60">Not provided</span>}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="text-sm opacity-70">{text}</div>;
}
