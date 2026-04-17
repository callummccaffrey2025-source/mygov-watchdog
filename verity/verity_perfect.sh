#!/usr/bin/env bash
set -euo pipefail

say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
die(){ printf "\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }

# 0) Preconditions
[ -f package.json ] || die "Run this from the project root (where package.json lives)."
command -v pnpm >/dev/null 2>&1 || die "pnpm required. Run: corepack enable && corepack prepare pnpm@latest --activate"

# 1) Dependencies (CSS toolchain + motion)
say "Install Tailwind v3 + PostCSS + Autoprefixer + framer-motion"
pnpm add -D tailwindcss@^3 postcss autoprefixer >/dev/null
pnpm add framer-motion >/dev/null

# 2) PostCSS/Tailwind configs as CommonJS (ESM-safe)
say "Write PostCSS & Tailwind configs (.cjs)"
rm -f postcss.config.* tailwind.config.*
cat > postcss.config.cjs <<'CJS'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
CJS

cat > tailwind.config.cjs <<'CJS'
/** @type {import("tailwindcss").Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: { ink: "#0b0f14", emerald: "#10b981" },
      fontFamily: {
        sans: ["ui-sans-serif","system-ui","-apple-system","Segoe UI","Roboto","Inter","sans-serif"]
      }
    }
  },
  plugins: [],
};
CJS

# 3) Ensure tsconfig baseUrl & @ alias
say "Patch tsconfig.json (baseUrl=src, paths @/*)"
node <<'NODE'
const fs=require('fs'); const p='tsconfig.json';
const j = fs.existsSync(p)? JSON.parse(fs.readFileSync(p,'utf8')) : {};
j.compilerOptions ||= {};
j.compilerOptions.baseUrl = 'src';
j.compilerOptions.paths ||= {};
j.compilerOptions.paths['@/*'] = ['*'];
// keep includes sensible
j.include = Array.from(new Set([...(j.include||[]), 'next-env.d.ts','src/**/*','tailwind.config.cjs','next.config.js']));
// exclude node_modules
j.exclude = ['node_modules'];
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log("patched:", p);
NODE

# 4) Directories
say "Create source tree"
mkdir -p src/{app,components/{ui,shared,mp,bill,news},lib} public

# 5) Global CSS (canonical Next location)
say "Write globals.css + theme tokens + helpers"
cat > src/app/globals.css <<'CSS'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Theme tokens */
:root{
  --bg:#0b0f14;        /* ink */
  --fg:#e5e7eb;        /* slate-200 */
  --muted:#9ca3af;     /* slate-400 */
  --card:rgba(255,255,255,.05);
  --border:rgba(255,255,255,.10);
  --accent:#10b981;    /* emerald */
}

/* Base */
html,body{height:100%}
body{
  background:var(--bg);
  color:var(--fg);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
}
a{ color:var(--accent) }
h1,h2,h3{ letter-spacing:-.01em }

/* Scrollbar */
::-webkit-scrollbar{ height:10px; width:10px }
::-webkit-scrollbar-thumb{ background:rgba(255,255,255,.12); border-radius:9999px }

/* Helpers */
.card{ @apply rounded-2xl p-6; background:var(--card); border:1px solid var(--border) }
.btn{ @apply rounded-xl px-4 py-2 font-medium; background:var(--accent); color:#0b0f14 }

/* Typography helpers */
.h1 { font-weight:600; font-size:1.875rem; letter-spacing:-.01em }
.lead { font-size:1.05rem; color:rgba(255,255,255,.7) }
.muted { color:rgba(255,255,255,.6) }
CSS

# 6) Types + sample data (for beautiful placeholders)
say "Write domain types & AU sample data"
cat > src/types.ts <<'TS'
export type MP = { id: string; name: string; party: string; electorate: string; };
export type Bill = { id: string; title: string; summary: string; status: string; introduced: string; sponsor?: string; };
export type NewsItem = { id: string; title: string; source: string; url: string; published: string; topic?: string; };
TS

cat > src/lib/sample-data.ts <<'TS'
import type { MP, Bill, NewsItem } from "@/types";

export const MPs: MP[] = [
  { id: "mp-albanese", name: "Anthony Albanese", party: "Labor", electorate: "Grayndler" },
  { id: "mp-dutton",    name: "Peter Dutton",    party: "Liberal", electorate: "Dickson" },
  { id: "mp-bandt",     name: "Adam Bandt",     party: "Greens", electorate: "Melbourne" },
];

export const Bills: Bill[] = [
  { id: "bill-privacy", title: "Privacy Amendment Bill", summary: "Strengthens privacy safeguards and penalties.", status: "House — Committee", introduced: "2025-08-12", sponsor: "Attorney-General" },
  { id: "bill-energy",  title: "Clean Energy Transition Bill", summary: "Framework for renewable build-out and storage.", status: "Senate — Second Reading", introduced: "2025-07-03" },
];

export const News: NewsItem[] = [
  { id: "n1", title: "Budget negotiations intensify", source: "ABC", url: "https://www.abc.net.au", published: new Date().toISOString(), topic: "Economy" },
  { id: "n2", title: "Emissions scheme update clears Senate", source: "The Guardian AU", url: "https://www.theguardian.com/au", published: new Date().toISOString(), topic: "Climate" },
  { id: "n3", title: "New integrity watchdog powers debated", source: "SBS", url: "https://www.sbs.com.au", published: new Date().toISOString(), topic: "Integrity" },
];
TS

# 7) UI components
say "Write UI components (Button, Badge, Card)"
cat > src/components/ui/Button.tsx <<'TSX'
import React from "react";
const base = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-emerald/60 disabled:opacity-50 disabled:pointer-events-none";
const variants: Record<string,string> = {
  primary: "bg-emerald text-[#0b0f14] hover:bg-[#15d19a]",
  ghost: "bg-transparent text-emerald hover:bg-white/5",
  outline: "border border-white/10 bg-transparent hover:bg-white/5",
};
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; };
export default function Button({variant="primary", className="", ...props}: Props){
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
TSX

cat > src/components/ui/Badge.tsx <<'TSX'
import React from "react";
export default function Badge({children}:{children: React.ReactNode}){
  return <span className="inline-flex items-center rounded-full bg-emerald/20 px-2 py-0.5 text-xs font-medium text-emerald">{children}</span>;
}
TSX

cat > src/components/ui/Card.tsx <<'TSX'
import React from "react";
type Props = { children: React.ReactNode; className?: string };
export default function Card({ children, className = "" }: Props) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 shadow-[0_2px_0_0_rgba(255,255,255,0.05)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)] ${className}`}>
      {children}
    </div>
  );
}
TSX

# 8) Domain cards (MP, Bill, News) with subtle motion ready
say "Write domain cards"
cat > src/components/mp/MPCard.tsx <<'TSX'
import type { MP } from "@/types";
import Card from "@/components/ui/Card";

export default function MPCard({ mp }: { mp: MP }){
  return (
    <Card className="p-5 transition hover:scale-[1.01]">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 shrink-0 rounded-full bg-emerald/20" />
        <div>
          <div className="font-medium">{mp.name}</div>
          <div className="text-xs text-white/60">{mp.party} — {mp.electorate}</div>
        </div>
      </div>
    </Card>
  );
}
TSX

cat > src/components/bill/BillCard.tsx <<'TSX'
import type { Bill } from "@/types";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export default function BillCard({ bill }: { bill: Bill }){
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{bill.title}</h3>
        <Badge>{bill.status}</Badge>
      </div>
      <p className="text-sm text-white/70">{bill.summary}</p>
      <div className="mt-3 text-xs text-white/50">
        Introduced {bill.introduced}
        {bill.sponsor && <> · Sponsor: {bill.sponsor}</>}
      </div>
    </Card>
  );
}
TSX

cat > src/components/news/NewsCard.tsx <<'TSX'
import type { NewsItem } from "@/types";
import Card from "@/components/ui/Card";

export default function NewsCard({ item }: { item: NewsItem }){
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className="block">
      <Card className="p-5 transition hover:translate-y-[-1px]">
        <div className="mb-1 text-xs text-white/60">{item.source} · {new Date(item.published).toLocaleDateString()}</div>
        <div className="font-medium text-emerald hover:underline">{item.title}</div>
        {item.topic && <div className="mt-1 text-xs text-white/50">{item.topic}</div>}
      </Card>
    </a>
  );
}
TSX

# 9) Shared components (Section, Nav with mobile drawer + a11y, Footer, States)
say "Write Section, Nav (mobile+a11y), Footer, States"
cat > src/components/shared/Section.tsx <<'TSX'
export default function Section({title, ctaHref, ctaText="See all", children}:{title:string; ctaHref?:string; ctaText?:string; children: React.ReactNode;}){
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {ctaHref && <a href={ctaHref} className="text-sm text-emerald hover:underline">{ctaText}</a>}
      </div>
      {children}
    </section>
  );
}
TSX

cat > src/components/shared/Nav.tsx <<'TSX'
"use client";
import { useEffect, useRef, useState } from "react";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0f14]/80 backdrop-blur">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute left-4 top-2 rounded bg-emerald px-3 py-1.5 text-[#0b0f14]"
      >
        Skip to content
      </a>
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="/" className="text-lg font-semibold tracking-tight text-emerald">
          Verity
        </a>

        {/* Desktop */}
        <div className="hidden items-center gap-6 text-sm text-white/80 md:flex">
          <a href="/mps" className="hover:text-white focus-visible:ring-2 focus-visible:ring-emerald/60">MPs</a>
          <a href="/bills" className="hover:text-white focus-visible:ring-2 focus-visible:ring-emerald/60">Bills</a>
          <a href="/news" className="hover:text-white focus-visible:ring-2 focus-visible:ring-emerald/60">News</a>
          <a href="/pricing" className="hover:text-white focus-visible:ring-2 focus-visible:ring-emerald/60">Pricing</a>
          <a href="/join" className="rounded-xl bg-emerald px-3 py-1.5 font-medium text-[#0b0f14] hover:bg-[#15d19a] focus-visible:ring-2 focus-visible:ring-emerald/60">Join</a>
        </div>

        {/* Mobile */}
        <button
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((x) => !x)}
          className="md:hidden inline-flex items-center justify-center rounded-lg p-2 focus-visible:ring-2 focus-visible:ring-emerald/60"
        >
          <span className="sr-only">Open Menu</span>
          <div className="h-5 w-6">
            <div className={`h-0.5 w-6 bg-current transition ${open ? "translate-y-2 rotate-45" : ""}`} />
            <div className={`mt-1.5 h-0.5 w-6 bg-current transition ${open ? "opacity-0" : ""}`} />
            <div className={`mt-1.5 h-0.5 w-6 bg-current transition ${open ? "-translate-y-2 -rotate-45" : ""}`} />
          </div>
        </button>
      </nav>

      {open && (
        <div
          id="mobile-menu"
          ref={panelRef}
          className="md:hidden border-t border-white/10 bg-[#0b0f14] px-4 pb-4 pt-2"
        >
          <div className="flex flex-col gap-2 text-sm">
            {["/mps","/bills","/news","/pricing"].map((href,i)=>(
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-emerald/60"
                onClick={()=>setOpen(false)}
              >
                {["MPs","Bills","News","Pricing"][i]}
              </a>
            ))}
            <a
              href="/join"
              className="rounded-lg bg-emerald px-3 py-2 font-medium text-[#0b0f14]"
              onClick={()=>setOpen(false)}
            >
              Join
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
TSX

cat > src/components/shared/Footer.tsx <<'TSX'
export default function Footer(){
  return (
    <footer className="mt-16 border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-white/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} Verity — Civic intelligence for Australia.</div>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/terms" className="hover:text-white">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
TSX

cat > src/components/shared/States.tsx <<'TSX'
export function LoadingCard(){ return <div className="h-24 rounded-2xl bg-white/5 animate-pulse" /> }
export function Empty({label}:{label:string}){ return <div className="text-sm text-white/60">{label}</div> }
export function ErrorMsg({msg}:{msg:string}){ return <div className="text-sm text-red-400">{msg}</div> }
TSX

# 10) App Router: layout + pages with metadata
say "Write layout.tsx with next/font, metadata, and #content anchor"
cat > src/app/layout.tsx <<'TSX'
import "./globals.css";
import Nav from "@/components/shared/Nav";
import Footer from "@/components/shared/Footer";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "Verity — Civic intelligence for Australia",
  description: "Personalized, source-linked clarity on MPs, bills, and news.",
  metadataBase: new URL("http://localhost:3000"),
  openGraph: {
    title: "Verity — Civic intelligence for Australia",
    description: "Personalized, source-linked clarity on MPs, bills, and news.",
    url: "http://localhost:3000",
    siteName: "Verity",
    images: [{ url: "/og.svg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Verity", description: "Civic intelligence for Australia.", images: ["/og.svg"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-[var(--bg)] text-[var(--fg)]`}>
        <Nav />
        <main id="content" className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
TSX

say "Write home, MPs, Bills, News, Pricing, Join pages"
cat > src/app/page.tsx <<'TSX'
import Section from "@/components/shared/Section";
import MPCard from "@/components/mp/MPCard";
import BillCard from "@/components/bill/BillCard";
import NewsCard from "@/components/news/NewsCard";
import Card from "@/components/ui/Card";
import { MPs, Bills, News } from "@/lib/sample-data";

export default function Page(){
  return (
    <div className="space-y-12">
      <Card className="p-6 bg-gradient-to-br from-white/5 to-white/[0.03]">
        <h1 className="h1 mb-2">What matters in Australian politics today</h1>
        <p className="lead">Personalized, source-linked clarity on MPs, bills, and news.</p>
      </Card>

      <Section title="Your MPs" ctaHref="/mps">
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
          {MPs.map((m)=> (<MPCard key={m.id} mp={m} />))}
        </div>
      </Section>

      <Section title="Active Bills" ctaHref="/bills">
        <div className="grid gap-5 md:grid-cols-2">
          {Bills.map((b)=> (<BillCard key={b.id} bill={b} />))}
        </div>
      </Section>

      <Section title="Latest News" ctaHref="/news">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {News.map((n)=> (<NewsCard key={n.id} item={n} />))}
        </div>
      </Section>
    </div>
  );
}
TSX

cat > src/app/mps/page.tsx <<'TSX'
import Section from "@/components/shared/Section";
import MPCard from "@/components/mp/MPCard";
import { MPs } from "@/lib/sample-data";
export default function Page(){
  return (
    <Section title="Members of Parliament">
      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
        {MPs.map((m)=> (<MPCard key={m.id} mp={m} />))}
      </div>
    </Section>
  );
}
TSX

cat > src/app/bills/page.tsx <<'TSX'
import Section from "@/components/shared/Section";
import BillCard from "@/components/bill/BillCard";
import { Bills } from "@/lib/sample-data";
export default function Page(){
  return (
    <Section title="Bills">
      <div className="grid gap-5 md:grid-cols-2">
        {Bills.map((b)=> (<BillCard key={b.id} bill={b} />))}
      </div>
    </Section>
  );
}
TSX

cat > src/app/news/page.tsx <<'TSX'
import Section from "@/components/shared/Section";
import NewsCard from "@/components/news/NewsCard";
import { News } from "@/lib/sample-data";
export default function Page(){
  return (
    <Section title="News">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {News.map((n)=> (<NewsCard key={n.id} item={n} />))}
      </div>
    </Section>
  );
}
TSX

cat > src/app/pricing/page.tsx <<'TSX'
import Section from "@/components/shared/Section";
import Card from "@/components/ui/Card";
export default function Page(){
  const tiers = [
    { name: "Citizen",     price: "$1/mo",  desc: "Personalized daily brief + dashboards." },
    { name: "Analyst",     price: "$15/mo", desc: "Advanced filters, exports, alerts." },
    { name: "Institution", price: "Talk to us", desc: "API, bulk seats, governance tools." },
  ];
  return (
    <Section title="Pricing">
      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map(t => (
          <Card key={t.name} className="p-6">
            <div className="mb-2 text-lg font-semibold">{t.name}</div>
            <div className="mb-2 text-2xl font-bold text-emerald">{t.price}</div>
            <div className="text-sm text-white/70">{t.desc}</div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
TSX

cat > src/app/join/page.tsx <<'TSX'
import Section from "@/components/shared/Section";
import Button from "@/components/ui/Button";
export default function Page(){
  return (
    <Section title="Join Verity">
      <form className="max-w-md space-y-4">
        <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none placeholder:text-white/50" placeholder="Email" />
        <Button className="w-full">Get started</Button>
      </form>
      <p className="mt-3 text-sm text-white/60">We will never sell your data. Unsubscribe anytime.</p>
    </Section>
  );
}
TSX

# 11) Error boundaries & 404
say "Write error & not-found pages"
cat > src/app/error.tsx <<'TSX'
"use client";
export default function Error({ error }: { error: Error }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-white/70">{error.message}</p>
    </div>
  );
}
TSX

cat > src/app/not-found.tsx <<'TSX'
export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-white/70">Try the navigation above.</p>
    </div>
  );
}
TSX

# 12) Public assets (OG image & favicon)
say "Write OG image (SVG) and minimal favicon.ico placeholder"
cat > public/og.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#0b0f14"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" fill="#10b981">
    <text x="72" y="200" font-size="72" font-weight="700">VERITY</text>
    <text x="72" y="280" font-size="36" fill="#e5e7eb">Civic intelligence for Australia</text>
  </g>
</svg>
SVG

# tiny favicon (1x1 black) — replace with your real icon later
printf '\x00\x00\x01\x00\x01\x00\x10\x10\x10\x00\x01\x00\x04\x00\x28\x01\x00\x00' > public/favicon.ico || true

# 13) Clean Next cache & start dev
say "Restart dev server (clearing .next cache)"
rm -rf .next
pkill -f next >/dev/null 2>&1 || true
pnpm dev
