#!/usr/bin/env bash
set -euo pipefail

log(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
die(){ printf "\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }

[ -f package.json ] || die "Run this in the project root (where package.json lives)."
command -v pnpm >/dev/null 2>&1 || die "pnpm required (corepack enable && corepack prepare pnpm@latest --activate)."

log "Install/ensure deps (Tailwind v3, PostCSS, Autoprefixer, Framer Motion)"
pnpm add -D tailwindcss@^3 postcss autoprefixer >/dev/null
pnpm add framer-motion >/dev/null

log "PostCSS/Tailwind config (.cjs, ESM-safe)"
rm -f postcss.config.* tailwind.config.*
cat > postcss.config.cjs <<'CJS'
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
CJS
cat > tailwind.config.cjs <<'CJS'
/** @type {import("tailwindcss").Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: { ink:"#0b0f14", emerald:"#10b981", mint:"#15d19a" },
      fontFamily: {
        sans: ["ui-sans-serif","system-ui","-apple-system","Segoe UI","Roboto","Inter","sans-serif"]
      },
      boxShadow: {
        card: "0 2px 0 0 rgba(255,255,255,0.05) inset, 0 8px 24px -12px rgba(0,0,0,0.6)"
      }
    }
  },
  plugins: [],
};
CJS

log "tsconfig: baseUrl=src and @/* alias"
node <<'NODE'
const fs=require('fs');const p='tsconfig.json';
const j=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{};
j.compilerOptions=j.compilerOptions||{};
j.compilerOptions.baseUrl='src';
j.compilerOptions.paths=j.compilerOptions.paths||{};
j.compilerOptions.paths['@/*']=['*'];
j.include=Array.from(new Set([...(j.include||[]),'src/**/*','next-env.d.ts','tailwind.config.cjs','next.config.js']));
j.exclude=['node_modules'];
fs.writeFileSync(p,JSON.stringify(j,null,2));
console.log('patched:',p);
NODE

log "Folders"
mkdir -p src/{app,lib,components/{ui,shared,hero,mp,bill,news}} public

log "Global CSS: theme tokens, helpers, utilities"
cat > src/app/globals.css <<'CSS'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Design tokens */
:root{
  --bg:#0b0f14;
  --fg:#e5e7eb;
  --muted:#9ca3af;
  --card:rgba(255,255,255,.05);
  --border:rgba(255,255,255,.10);
  --accent:#10b981;
  --accent-2:#15d19a;
}

/* Base */
html,body{height:100%}
body{
  background:var(--bg);
  color:var(--fg);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif;
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
}

a{ color:var(--accent) }
h1,h2,h3{ letter-spacing:-.01em }

/* Scrollbar */
::-webkit-scrollbar{ width:10px; height:10px }
::-webkit-scrollbar-thumb{ background:rgba(255,255,255,.12); border-radius:9999px }

/* Reusable helpers */
.container-verity{ @apply mx-auto max-w-6xl px-4 }
.card{ @apply rounded-2xl border border-white/10 bg-white/5 shadow-card }
.btn{ @apply inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-emerald/60 }
.btn-primary{ @apply bg-[var(--accent)] text-[#0b0f14] hover:bg-[var(--accent-2)] }
.btn-ghost{ @apply text-[var(--accent)] hover:bg-white/5 }
.badge{ @apply inline-flex items-center rounded-full bg-emerald/20 px-2 py-0.5 text-xs font-medium text-emerald }

.h1{ font-weight:700; font-size:2rem; letter-spacing:-.02em }
.lead{ font-size:1.05rem; color:rgba(255,255,255,.75) }
.muted{ color:rgba(255,255,255,.6) }
CSS

log "Types + sample data"
cat > src/types.ts <<'TS'
export type MP = { id:string; name:string; party:string; electorate:string };
export type Bill = { id:string; title:string; summary:string; status:string; introduced:string; sponsor?:string };
export type NewsItem = { id:string; title:string; source:string; url:string; published:string; topic?:string };
TS
cat > src/lib/sample-data.ts <<'TS'
import type { MP, Bill, NewsItem } from "@/types";

export const MPs: MP[] = [
  { id:"albanese", name:"Anthony Albanese", party:"Labor", electorate:"Grayndler" },
  { id:"dutton",   name:"Peter Dutton",    party:"Liberal", electorate:"Dickson" },
  { id:"bandt",    name:"Adam Bandt",     party:"Greens", electorate:"Melbourne" },
];

export const Bills: Bill[] = [
  { id:"privacy", title:"Privacy Amendment Bill", summary:"Strengthens privacy safeguards and penalties.", status:"House — Committee", introduced:"2025-08-12", sponsor:"Attorney-General" },
  { id:"netzero", title:"Clean Energy Transition Bill", summary:"Framework for renewable build-out and storage.", status:"Senate — Second Reading", introduced:"2025-07-03" }
];

export const News: NewsItem[] = [
  { id:"n1", title:"Budget negotiations intensify", source:"ABC", url:"https://www.abc.net.au", published:new Date().toISOString(), topic:"Economy" },
  { id:"n2", title:"Emissions scheme update clears Senate", source:"The Guardian AU", url:"https://www.theguardian.com/au", published:new Date().toISOString(), topic:"Climate" },
  { id:"n3", title:"New integrity watchdog powers debated", source:"SBS", url:"https://www.sbs.com.au", published:new Date().toISOString(), topic:"Integrity" },
];
TS

log "UI primitives"
cat > src/components/ui/Button.tsx <<'TSX'
import React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"ghost"|"outline"; };
export default function Button({variant="primary", className="", ...props}: Props){
  const base = "btn";
  const v = variant==="primary" ? "btn-primary" : variant==="ghost" ? "btn-ghost" : "border border-white/10 hover:bg-white/5";
  return <button className={`${base} ${v} ${className}`} {...props} />;
}
TSX
cat > src/components/ui/Badge.tsx <<'TSX'
import React from "react";
export default function Badge({children}:{children:React.ReactNode}){ return <span className="badge">{children}</span>; }
TSX
cat > src/components/ui/Card.tsx <<'TSX'
import React from "react";
export default function Card({children,className=""}:{children:React.ReactNode; className?:string}){
  return <div className={`card ${className}`}>{children}</div>;
}
TSX
cat > src/components/ui/Divider.tsx <<'TSX'
export default function Divider(){ return <div className="h-px w-full bg-white/10" /> }
TSX
cat > src/components/ui/Skeleton.tsx <<'TSX'
export default function Skeleton({className=""}:{className?:string}){ return <div className={`animate-pulse rounded-xl bg-white/10 ${className}`} /> }
TSX
cat > src/components/ui/Pill.tsx <<'TSX'
export default function Pill({children}:{children:React.ReactNode}){ return <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/80">{children}</span> }
TSX

log "Domain cards"
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
        Introduced {bill.introduced}{bill.sponsor && <> · Sponsor: {bill.sponsor}</>}
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

log "Shared building blocks (Section, Nav with active states + mobile drawer, Footer, States)"
cat > src/components/shared/Section.tsx <<'TSX'
export default function Section({title,ctaHref,ctaText="See all",children}:{title:string;ctaHref?:string;ctaText?:string;children:React.ReactNode}){
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
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const link = "relative px-3 py-1.5 text-sm text-white/80 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald/60 rounded-md";
const active = "text-emerald";

export default function Nav(){
  const [open,setOpen]=useState(false);
  const pathname=usePathname();

  useEffect(()=>{ document.body.style.overflow=open?"hidden":""; },[open]);

  const L = ({href,label}:{href:string;label:string}) => (
    <a href={href} className={`${link} ${pathname===href?active:""}`} onClick={()=>setOpen(false)}>{label}
      {pathname===href && <span className="absolute inset-x-2 -bottom-[6px] h-[2px] bg-emerald/80" />}
    </a>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0f14]/80 backdrop-blur">
      <nav className="container-verity flex items-center justify-between py-3">
        <a href="/" className="text-lg font-semibold tracking-tight text-emerald">Verity</a>
        <div className="hidden items-center gap-2 md:flex">
          <L href="/mps" label="MPs" />
          <L href="/bills" label="Bills" />
          <L href="/news" label="News" />
          <L href="/pricing" label="Pricing" />
          <a href="/join" className="btn btn-primary ml-1">Join</a>
        </div>
        <button aria-expanded={open} className="md:hidden rounded-lg p-2 focus-visible:ring-2 focus-visible:ring-emerald/60" onClick={()=>setOpen(v=>!v)}>
          <span className="sr-only">Open Menu</span>
          <div className="h-5 w-6">
            <div className={`h-0.5 w-6 bg-current transition ${open?"translate-y-2 rotate-45":""}`} />
            <div className={`mt-1.5 h-0.5 w-6 bg-current transition ${open?"opacity-0":""}`} />
            <div className={`mt-1.5 h-0.5 w-6 bg-current transition ${open?"-translate-y-2 -rotate-45":""}`} />
          </div>
        </button>
      </nav>
      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#0b0f14]">
          <div className="container-verity flex flex-col gap-2 py-3">
            <L href="/mps" label="MPs" />
            <L href="/bills" label="Bills" />
            <L href="/news" label="News" />
            <L href="/pricing" label="Pricing" />
            <a href="/join" className="btn btn-primary w-max">Join</a>
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
      <div className="container-verity py-10 text-sm text-white/70">
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

log "Animated hero (motion, glass gradient)"
cat > src/components/hero/Hero.tsx <<'TSX'
"use client";
import { motion } from "framer-motion";
import Pill from "@/components/ui/Pill";

export default function Hero(){
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.03] p-8 sm:p-10">
      <div className="pointer-events-none absolute -top-28 -left-28 h-72 w-72 rounded-full bg-emerald/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-emerald/10 blur-3xl" />
      <motion.div
        initial={{ opacity:0, y: 12 }} animate={{ opacity:1, y:0 }}
        transition={{ duration:0.6, ease:"easeOut" }}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Pill>Source-linked</Pill>
          <Pill>Bias-aware</Pill>
          <Pill>Personalized</Pill>
        </div>
        <h1 className="h1 mb-2">What matters in Australian politics today</h1>
        <p className="lead">Personalized, verifiable clarity across MPs, bills, and news — built for trust.</p>
      </motion.div>
    </div>
  );
}
TSX

log "App Router: layout + pages + metadata"
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
        <main id="content" className="container-verity py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
TSX

cat > src/app/page.tsx <<'TSX'
import Hero from "@/components/hero/Hero";
import Section from "@/components/shared/Section";
import MPCard from "@/components/mp/MPCard";
import BillCard from "@/components/bill/BillCard";
import NewsCard from "@/components/news/NewsCard";
import { MPs, Bills, News } from "@/lib/sample-data";

export default function Page(){
  return (
    <div className="space-y-12">
      <Hero />

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

log "Error & 404"
cat > src/app/error.tsx <<'TSX'
"use client";
export default function Error({ error }: { error: Error }) {
  return (
    <div className="container-verity py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-white/70">{error.message}</p>
    </div>
  );
}
TSX
cat > src/app/not-found.tsx <<'TSX'
export default function NotFound() {
  return (
    <div className="container-verity py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-white/70">Try the navigation above.</p>
    </div>
  );
}
TSX

log "Public OG + favicon"
cat > public/og.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#0b0f14"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" fill="#10b981">
    <text x="72" y="200" font-size="72" font-weight="700">VERITY</text>
    <text x="72" y="280" font-size="36" fill="#e5e7eb">Civic intelligence for Australia</text>
  </g>
</svg>
SVG
printf '\x00\x00\x01\x00\x01\x00\x10\x10\x10\x00\x01\x00\x04\x00\x28\x01\x00\x00' > public/favicon.ico || true

log "Rebuild & run"
rm -rf .next
pkill -f next >/dev/null 2>&1 || true
pnpm dev
