#!/usr/bin/env bash
set -euo pipefail

say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
fail(){ printf "\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }

[ -f package.json ] || fail "Run this in the project root (where package.json is)."
command -v pnpm >/dev/null 2>&1 || fail "pnpm required (corepack enable && corepack prepare pnpm@latest --activate)."

say "Install backend deps (Prisma/ORM, validation, dates)"
pnpm add @prisma/client zod date-fns >/dev/null
pnpm add -D prisma >/dev/null

say "Create Prisma schema (SQLite)"
mkdir -p prisma
cat > prisma/schema.prisma <<'PRISMA'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model MP {
  id         String  @id
  name       String
  party      String
  electorate String
}

model Bill {
  id         String  @id
  title      String
  summary    String
  status     String
  introduced DateTime
  sponsor    String?
}

model News {
  id         String  @id
  title      String
  source     String
  url        String
  published  DateTime
  topic      String?
}

model Subscriber {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
}
PRISMA

say "Patch package.json with scripts (db push/seed)"
node <<'NODE'
import fs from 'fs';
const p='package.json';
const j=JSON.parse(fs.readFileSync(p,'utf8'));
j.scripts=j.scripts||{};
j.scripts["db:push"]="prisma db push";
j.scripts["db:gen"]="prisma generate";
j.scripts["db:seed"]="node prisma/seed.mjs";
fs.writeFileSync(p,JSON.stringify(j,null,2));
console.log('patched:',p);
NODE

say "Generate Prisma client & push schema"
pnpm prisma generate >/dev/null
pnpm prisma db push >/dev/null

say "DB seed with realistic AU data"
cat > prisma/seed.mjs <<'SEED'
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main(){
  // MPs (leaders; real seats; neutral labels)
  const mps = [
    { id:"albanese", name:"Anthony Albanese", party:"Labor", electorate:"Grayndler" },
    { id:"dutton",   name:"Peter Dutton",    party:"Liberal", electorate:"Dickson" },
    { id:"bandt",    name:"Adam Bandt",     party:"Greens", electorate:"Melbourne" },
  ];

  // Bills (example current-style placeholders with neutral language)
  const bills = [
    {
      id:"privacy-amendment-bill",
      title:"Privacy Amendment Bill",
      summary:"Strengthens privacy safeguards and penalties.",
      status:"House — Committee",
      introduced:new Date("2025-08-12T00:00:00Z"),
      sponsor:"Attorney-General"
    },
    {
      id:"clean-energy-transition-bill",
      title:"Clean Energy Transition Bill",
      summary:"Framework for renewable build-out and storage.",
      status:"Senate — Second Reading",
      introduced:new Date("2025-07-03T00:00:00Z"),
      sponsor:null
    }
  ];

  // News (neutral, recent-style placeholders linking to well-known domains)
  const now = new Date();
  const news = [
    { id:"n1", title:"Budget negotiations intensify", source:"ABC", url:"https://www.abc.net.au/news", published:now, topic:"Economy" },
    { id:"n2", title:"Emissions scheme update clears Senate", source:"The Guardian AU", url:"https://www.theguardian.com/au", published:now, topic:"Climate" },
    { id:"n3", title:"New integrity watchdog powers debated", source:"SBS", url:"https://www.sbs.com.au/news", published:now, topic:"Integrity" },
  ];

  await prisma.subscriber.deleteMany();
  await prisma.news.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.mP.deleteMany();

  await prisma.mP.createMany({ data: mps });
  await prisma.bill.createMany({ data: bills });
  await prisma.news.createMany({ data: news });

  console.log("seeded MPs:", mps.length, "bills:", bills.length, "news:", news.length);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>{await prisma.$disconnect();});
SEED

pnpm run db:seed >/dev/null

say "Prisma client singleton"
mkdir -p src/lib
cat > src/lib/db.ts <<'TS'
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query","error","warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
TS

say "Server helpers (queries)"
cat > src/lib/queries.ts <<'TS'
import { prisma } from "./db";

export async function getMPs(){ return prisma.mP.findMany({ orderBy:{ name:"asc" } }); }
export async function getBills(){ return prisma.bill.findMany({ orderBy:{ introduced:"desc" } }); }
export async function getNews(){ return prisma.news.findMany({ orderBy:{ published:"desc" } }); }

export async function addSubscriber(email:string){
  email = email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
  return prisma.subscriber.create({ data:{ email } });
}
TS

say "API route: /api/subscribe (POST)"
mkdir -p src/app/api/subscribe
cat > src/app/api/subscribe/route.ts <<'TS'
import { NextResponse } from "next/server";
import { addSubscriber } from "@/lib/queries";

export async function POST(req: Request){
  try{
    const { email } = await req.json();
    if(!email) return NextResponse.json({ error:"Email required" },{ status:400 });
    await addSubscriber(email);
    return NextResponse.json({ ok:true });
  }catch(e:any){
    const msg = e?.code === "P2002" ? "Already subscribed" : e?.message || "Failed";
    return NextResponse.json({ error: msg },{ status:400 });
  }
}
TS

say "robots.txt & sitemap.xml"
mkdir -p src/app/(meta)
cat > src/app/robots.txt/route.ts <<'TS'
export function GET(){
  const body = `User-agent: *\nAllow: /\nSitemap: http://localhost:3000/sitemap.xml\n`;
  return new Response(body,{ headers:{ "Content-Type":"text/plain" }});
}
TS
cat > src/app/sitemap.xml/route.ts <<'TS'
export function GET(){
  const pages = ["","/mps","/bills","/news","/pricing","/join"].map(p=>`  <url><loc>http://localhost:3000${p}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages}\n</urlset>\n`;
  return new Response(xml,{ headers:{ "Content-Type":"application/xml" }});
}
TS

say "Replace sample-data imports to DB queries in pages"
# Home
cat > src/app/page.tsx <<'TSX'
import Hero from "@/components/hero/Hero";
import Section from "@/components/shared/Section";
import MPCard from "@/components/mp/MPCard";
import BillCard from "@/components/bill/BillCard";
import NewsCard from "@/components/news/NewsCard";
import { getMPs, getBills, getNews } from "@/lib/queries";

export default async function Page(){
  const [mps, bills, news] = await Promise.all([getMPs(), getBills(), getNews()]);
  return (
    <div className="space-y-12">
      <Hero />
      <Section title="Your MPs" ctaHref="/mps">
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
          {mps.map((m)=> (<MPCard key={m.id} mp={m} />))}
        </div>
      </Section>
      <Section title="Active Bills" ctaHref="/bills">
        <div className="grid gap-5 md:grid-cols-2">
          {bills.map((b)=> (<BillCard key={b.id} bill={b} />))}
        </div>
      </Section>
      <Section title="Latest News" ctaHref="/news">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {news.map((n)=> (<NewsCard key={n.id} item={n} />))}
        </div>
      </Section>
    </div>
  );
}
TSX

# MPs page
cat > src/app/mps/page.tsx <<'TSX'
import Section from "@/components/shared/Section";
import MPCard from "@/components/mp/MPCard";
import { getMPs } from "@/lib/queries";
export default async function Page(){
  const mps = await getMPs();
  return (
    <Section title="Members of Parliament">
      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
        {mps.map((m)=> (<MPCard key={m.id} mp={m} />))}
      </div>
    </Section>
  );
}
TSX

# Bills page
cat > src/app/bills/page.tsx <<'TSX'
import Section from "@/components/shared/Section";
import BillCard from "@/components/bill/BillCard";
import { getBills } from "@/lib/queries";
export default async function Page(){
  const bills = await getBills();
  return (
    <Section title="Bills">
      <div className="grid gap-5 md:grid-cols-2">
        {bills.map((b)=> (<BillCard key={b.id} bill={b} />))}
      </div>
    </Section>
  );
}
TSX

# News page
cat > src/app/news/page.tsx <<'TSX'
import Section from "@/components/shared/Section";
import NewsCard from "@/components/news/NewsCard";
import { getNews } from "@/lib/queries";
export default async function Page(){
  const news = await getNews();
  return (
    <Section title="News">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {news.map((n)=> (<NewsCard key={n.id} item={n} />))}
      </div>
    </Section>
  );
}
TSX

# Pricing & Join (Join posts to /api/subscribe and persists)
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
"use client";
import Section from "@/components/shared/Section";
import Button from "@/components/ui/Button";
import { useState } from "react";

export default function Page(){
  const [email,setEmail]=useState("");
  const [msg,setMsg]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);

  async function onSubmit(e:React.FormEvent){
    e.preventDefault();
    setMsg(null); setLoading(true);
    try{
      const r = await fetch("/api/subscribe",{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json();
      if(!r.ok) throw new Error(j.error || "Failed");
      setMsg("You're in — thanks for joining Verity!");
      setEmail("");
    }catch(err:any){
      setMsg(err?.message || "Could not subscribe");
    }finally{ setLoading(false); }
  }

  return (
    <Section title="Join Verity">
      <form onSubmit={onSubmit} className="max-w-md space-y-4">
        <input
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none placeholder:text-white/50"
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          required
          type="email"
        />
        <Button disabled={loading} className="w-full">{loading ? "Working..." : "Get started"}</Button>
      </form>
      {msg && <p className="mt-3 text-sm text-white/80">{msg}</p>}
      <p className="mt-2 text-xs text-white/60">We will never sell your data. Unsubscribe anytime.</p>
    </Section>
  );
}
TSX

say "Ensure layout/hero/components exist (visual layer stays premium)"
# (We leave your improved UI components and globals in place)

say "Final clean & run"
rm -rf .next
pnpm prisma generate >/dev/null
pnpm prisma db push >/dev/null
pnpm run db:seed >/dev/null
pkill -f next >/dev/null 2>&1 || true
pnpm dev
