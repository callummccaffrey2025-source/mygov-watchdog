#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
fail(){ printf "\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }
[ -f package.json ] || fail "Run in project root."

command -v pnpm >/dev/null 2>&1 || fail "pnpm required (corepack enable && corepack prepare pnpm@latest --activate)"

# --- Decide DB provider (Postgres via Docker if available, else SQLite) ---
use_pg=0
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  use_pg=1
fi

say "Install server deps (cron, RSS, Prisma client) & tools"
pnpm add @prisma/client zod rss-parser date-fns >/dev/null
pnpm add -D prisma concurrently >/dev/null

mkdir -p prisma src/{lib,app/api/ingest} scripts

if [ $use_pg -eq 1 ]; then
  say "Docker found — configuring PostgreSQL + prisma (postgresql)"
  # docker compose file
  cat > docker-compose.yml <<'YML'
services:
  db:
    image: postgres:16-alpine
    container_name: verity_pg
    environment:
      POSTGRES_USER: verity
      POSTGRES_PASSWORD: verity
      POSTGRES_DB: verity
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL","pg_isready -U verity -d verity"]
      interval: 3s
      timeout: 2s
      retries: 20
YML
  # env
  touch .env.local
  awk 'BEGIN{printed=0} /DATABASE_URL=/{printed=1} {print} END{if(!printed)print ""}' .env.local > .env.local.tmp && mv .env.local.tmp .env.local
  if ! grep -q "DATABASE_URL=" .env.local; then
    echo "DATABASE_URL=postgresql://verity:verity@localhost:5432/verity?schema=public" >> .env.local
  fi

  cat > prisma/schema.prisma <<'PRISMA'
generator client { provider = "prisma-client-js" }
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
model MP { id String @id @db.VarChar(64) name String party String electorate String }
model Bill {
  id String @id @db.VarChar(128)
  title String
  summary String
  status String
  introduced DateTime
  sponsor String?
}
model News {
  id String @id @db.VarChar(64)
  title String
  source String
  url String
  published DateTime
  topic String?
}
model Subscriber {
  id String @id @default(cuid())
  email String @unique
  createdAt DateTime @default(now())
}
PRISMA

  say "Starting Postgres (Docker)"
  docker compose up -d
else
  warn "Docker/Postgres not found — using SQLite (you can switch to Postgres later)."
  cat > prisma/schema.prisma <<'PRISMA'
generator client { provider = "prisma-client-js" }
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
model MP { id String @id name String party String electorate String }
model Bill {
  id String @id
  title String
  summary String
  status String
  introduced DateTime
  sponsor String?
}
model News {
  id String @id
  title String
  source String
  url String
  published DateTime
  topic String?
}
model Subscriber {
  id String @id @default(cuid())
  email String @unique
  createdAt DateTime @default(now())
}
PRISMA
fi

say "Prisma generate & push"
pnpm prisma generate >/dev/null
pnpm prisma db push >/dev/null

say "Seed (neutral AU starter data)"
cat > prisma/seed.mjs <<'SEED'
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run(){
  const mps = [
    { id:"albanese", name:"Anthony Albanese", party:"Labor",   electorate:"Grayndler" },
    { id:"dutton",   name:"Peter Dutton",    party:"Liberal",  electorate:"Dickson"   },
    { id:"bandt",    name:"Adam Bandt",     party:"Greens",   electorate:"Melbourne" }
  ];
  const bills = [
    { id:"privacy-amendment-bill", title:"Privacy Amendment Bill", summary:"Strengthens privacy safeguards and penalties.", status:"House — Committee", introduced:new Date("2025-08-12T00:00:00Z"), sponsor:"Attorney-General" },
    { id:"clean-energy-transition-bill", title:"Clean Energy Transition Bill", summary:"Framework for renewable build-out and storage.", status:"Senate — Second Reading", introduced:new Date("2025-07-03T00:00:00Z") }
  ];
  const now = new Date();
  const news = [
    { id:"n1", title:"Budget negotiations intensify", source:"ABC", url:"https://www.abc.net.au/news", published:now, topic:"Economy" },
    { id:"n2", title:"Emissions scheme update clears Senate", source:"The Guardian AU", url:"https://www.theguardian.com/au", published:now, topic:"Climate" },
    { id:"n3", title:"New integrity watchdog powers debated", source:"SBS", url:"https://www.sbs.com.au/news", published:now, topic:"Integrity" },
  ];
  await prisma.subscriber.deleteMany(); await prisma.news.deleteMany(); await prisma.bill.deleteMany(); await prisma.mP.deleteMany();
  await prisma.mP.createMany({ data:mps }); await prisma.bill.createMany({ data:bills }); await prisma.news.createMany({ data:news });
  console.log("seeded:", { mps:mps.length, bills:bills.length, news:news.length });
}
run().finally(()=>process.exit(0));
SEED
pnpm node prisma/seed.mjs >/dev/null

say "DB client singleton + queries"
cat > src/lib/db.ts <<'TS'
import { PrismaClient } from "@prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ log: process.env.NODE_ENV==="development"?["query","error","warn"]:["error"] });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
TS
cat > src/lib/queries.ts <<'TS'
import { prisma } from "./db";
export async function getMPs(){ return prisma.mP.findMany({ orderBy:{ name:"asc" } }); }
export async function getBills(){ return prisma.bill.findMany({ orderBy:{ introduced:"desc" } }); }
export async function getNews(){ return prisma.news.findMany({ orderBy:{ published:"desc" } }); }
export async function upsertNews(items:{id:string;title:string;source:string;url:string;published:Date;topic?:string}[]){
  for(const n of items){
    await prisma.news.upsert({ where:{ id:n.id }, update:n, create:n });
  }
}
export async function addSubscriber(email:string){
  const e = email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Invalid email");
  return prisma.subscriber.create({ data:{ email:e } });
}
TS

say "Ingestion adapters (RSS now; bill/Hansard stubs with env-driven endpoints)"
mkdir -p scripts
cat > scripts/adapters.mjs <<'JS'
import Parser from "rss-parser";

/** News via RSS (real) */
export async function fetchNewsFromRSS() {
  const feeds = [
    process.env.NEWS_RSS_1 || "https://www.abc.net.au/news/feed/51120/rss.xml",  // ABC Politics
    process.env.NEWS_RSS_2 || "https://www.theguardian.com/australia-news/australian-politics/rss",
    process.env.NEWS_RSS_3 || "https://www.sbs.com.au/news/topic/politics/rss"
  ];
  const parser = new Parser();
  const items = [];
  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const it of feed.items.slice(0, 20)) {
        const id = (it.guid || it.link || it.title || "").slice(0, 64);
        if (!id) continue;
        items.push({
          id,
          title: it.title || "Untitled",
          source: (feed.title || new URL(url).hostname).replace(/ - .*$/,""),
          url: it.link || url,
          published: it.isoDate ? new Date(it.isoDate) : new Date(),
          topic: "Politics"
        });
      }
    } catch (e) {
      console.error("RSS error:", url, e?.message);
    }
  }
  return items;
}

/** Bills from JSON (placeholder) — supply env/BILLS_JSON pointing to a JSON array */
export async function fetchBillsFromJSON() {
  const endpoint = process.env.BILLS_JSON;
  if (!endpoint) return [];
  const res = await fetch(endpoint, { headers: { "accept":"application/json" }});
  if (!res.ok) throw new Error("Bills JSON fetch failed");
  const arr = await res.json();
  // expect objects with: id,title,summary,status,introduced,sponsor?
  return Array.isArray(arr) ? arr.map((b)=>({
    id:String(b.id).slice(0,128),
    title:b.title, summary:b.summary||"", status:b.status||"—",
    introduced:new Date(b.introduced||Date.now()), sponsor:b.sponsor||null
  })) : [];
}

/** Hansard from JSON/CSV (stub) — supply env/HANSARD_JSON; kept for future enrichment */
export async function fetchHansardFromJSON(){
  const endpoint = process.env.HANSARD_JSON;
  if (!endpoint) return [];
  const r = await fetch(endpoint, { headers:{ "accept":"application/json" }});
  if (!r.ok) throw new Error("Hansard fetch failed");
  const arr = await r.json();
  return Array.isArray(arr)?arr:[];
}
JS

say "Cron runner (node) — ingests every 30 min; on boot runs once"
cat > scripts/ingest.mjs <<'JS'
import "dotenv/config";
import { upsertNews } from "../src/lib/queries.ts";
import { fetchNewsFromRSS, fetchBillsFromJSON, fetchHansardFromJSON } from "./adapters.mjs";

async function runOnce(){
  console.log("[ingest] started");
  try{
    const news = await fetchNewsFromRSS();
    if (news.length) {
      await upsertNews(news);
      console.log("[ingest] news upserted:", news.length);
    } else {
      console.log("[ingest] no news items parsed");
    }
    // Bills / Hansard adapters are available (env-driven). Extend as desired.
    if (process.env.BILLS_JSON) {
      const bills = await fetchBillsFromJSON();
      console.log("[ingest] bills fetched:", bills.length, "(adapter ready for mapping -> prisma)");
      // Example: upsert to prisma.bill if endpoint fields align (optional).
      // (Left no-op by default to avoid unsafe assumptions.)
    }
    if (process.env.HANSARD_JSON) {
      const hansard = await fetchHansardFromJSON();
      console.log("[ingest] hansard fetched:", hansard.length);
    }
  }catch(e){ console.error("[ingest] failed:", e?.message); }
}

await runOnce();

const intervalMin = Number(process.env.INGEST_EVERY_MIN || 30);
setInterval(runOnce, intervalMin*60*1000);
console.log(`[ingest] scheduled every ${intervalMin} minutes`);
JS

say "On-demand API trigger: POST /api/ingest"
cat > src/app/api/ingest/route.ts <<'TS'
import { NextResponse } from "next/server";
import { upsertNews } from "@/lib/queries";
import { fetchNewsFromRSS } from "../../../scripts/adapters.mjs";

export async function POST(){
  try{
    const items = await fetchNewsFromRSS();
    if(items.length) await upsertNews(items);
    return NextResponse.json({ ok:true, count: items.length });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || "failed" }, { status:500 });
  }
}
TS

say "Join API (already present? ensure)"
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

say "Dev script: run Next + Cron together"
node <<'NODE'
import fs from 'fs';
const p='package.json'; const j=JSON.parse(fs.readFileSync(p,'utf8'));
j.scripts=j.scripts||{};
j.scripts["dev"]="concurrently -k -n web,cron \"next dev\" \"node --loader ts-node/esm --no-warnings scripts/ingest.mjs || node scripts/ingest.mjs\"";
j.scripts["ingest:run"]="node scripts/ingest.mjs";
j.scripts["ingest:once"]="INGEST_EVERY_MIN=0 node scripts/ingest.mjs";
fs.writeFileSync(p,JSON.stringify(j,null,2)); console.log("patched:",p);
NODE

# Note: Use plain node for scripts/ingest.mjs (ESM). Provide ts-node fallback loader if user has it; else normal node works.

say "Env defaults (cron interval + RSS)"
touch .env.local
if ! grep -q "INGEST_EVERY_MIN=" .env.local; then echo "INGEST_EVERY_MIN=30" >> .env.local; fi
if ! grep -q "NEWS_RSS_1=" .env.local; then
  {
    echo 'NEWS_RSS_1=https://www.abc.net.au/news/feed/51120/rss.xml'
    echo 'NEWS_RSS_2=https://www.theguardian.com/australia-news/australian-politics/rss'
    echo 'NEWS_RSS_3=https://www.sbs.com.au/news/topic/politics/rss'
    echo '# Optional bill/Hansard sources:'
    echo '# BILLS_JSON='
    echo '# HANSARD_JSON='
  } >> .env.local
fi

say "Final DB sync, seed, then run dev + cron"
rm -rf .next
pnpm prisma generate >/dev/null
pnpm prisma db push >/dev/null
pnpm node prisma/seed.mjs >/dev/null || true
pkill -f next >/dev/null 2>&1 || true
pnpm dev
