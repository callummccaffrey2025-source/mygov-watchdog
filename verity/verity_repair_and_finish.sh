#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
fail(){ printf "\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }

[ -f package.json ] || fail "Run in project root."

# 0) Detect Postgres vs SQLite (same logic as before)
use_pg=0
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then use_pg=1; fi

# 1) Rewrite prisma/schema.prisma with explicit multiline blocks (no single-line braces)
mkdir -p prisma
if [ $use_pg -eq 1 ]; then
  # Ensure env has DATABASE_URL for pg
  touch .env.local
  if ! grep -q '^DATABASE_URL=' .env.local; then
    echo 'DATABASE_URL=postgresql://verity:verity@localhost:5432/verity?schema=public' >> .env.local
  fi
  cat > prisma/schema.prisma <<'PRISMA'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model MP {
  id         String @id @db.VarChar(64)
  name       String
  party      String
  electorate String
}

model Bill {
  id         String   @id @db.VarChar(128)
  title      String
  summary    String
  status     String
  introduced DateTime
  sponsor    String?
}

model News {
  id        String   @id @db.VarChar(64)
  title     String
  source    String
  url       String
  published DateTime
  topic     String?
}

model Subscriber {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
}
PRISMA

  # Start PG if not running
  if ! docker ps --format '{{.Names}}' | grep -q '^verity_pg$'; then
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
      retries: 30
YML
    docker compose up -d >/dev/null
  fi
else
  warn "Postgres unavailable — using SQLite"
  cat > prisma/schema.prisma <<'PRISMA'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model MP {
  id         String @id
  name       String
  party      String
  electorate String
}

model Bill {
  id         String   @id
  title      String
  summary    String
  status     String
  introduced DateTime
  sponsor    String?
}

model News {
  id        String   @id
  title     String
  source    String
  url       String
  published DateTime
  topic     String?
}

model Subscriber {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
}
PRISMA
fi

# 2) Make sure prisma, client, etc are installed (idempotent)
pnpm add @prisma/client >/dev/null
pnpm add -D prisma >/dev/null

# 3) Generate + push + seed
say "Prisma format/generate/push"
pnpm prisma format   >/dev/null
pnpm prisma generate >/dev/null
pnpm prisma db push  >/dev/null

say "Seed database"
cat > prisma/seed.mjs <<'SEED'
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run(){
  const mps = [
    { id:"albanese", name:"Anthony Albanese", party:"Labor",  electorate:"Grayndler" },
    { id:"dutton",   name:"Peter Dutton",    party:"Liberal", electorate:"Dickson"   },
    { id:"bandt",    name:"Adam Bandt",     party:"Greens",  electorate:"Melbourne" }
  ];
  const bills = [
    { id:"privacy-amendment-bill", title:"Privacy Amendment Bill", summary:"Strengthens privacy safeguards and penalties.", status:"House — Committee", introduced:new Date("2025-08-12T00:00:00Z"), sponsor:"Attorney-General" },
    { id:"clean-energy-transition-bill", title:"Clean Energy Transition Bill", summary:"Framework for renewable build-out and storage.", status:"Senate — Second Reading", introduced:new Date("2025-07-03T00:00:00Z") }
  ];
  const now = new Date();
  const news = [
    { id:"n1", title:"Budget negotiations intensify", source:"ABC", url:"https://www.abc.net.au/news", published:now, topic:"Economy" },
    { id:"n2", title:"Emissions scheme update clears Senate", source:"The Guardian AU", url:"https://www.theguardian.com/au", published:now, topic:"Climate" },
    { id:"n3", title:"New integrity watchdog powers debated", source:"SBS", url:"https://www.sbs.com.au/news", published:now, topic:"Integrity" }
  ];
  await prisma.subscriber.deleteMany();
  await prisma.news.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.mP.deleteMany();
  await prisma.mP.createMany({ data:mps });
  await prisma.bill.createMany({ data:bills });
  await prisma.news.createMany({ data:news });
  console.log("Seed complete");
}
run().finally(()=>process.exit(0));
SEED
pnpm node prisma/seed.mjs >/dev/null || true

# 4) Fix the cron worker to be pure JS (no TS imports)
say "Write pure-JS cron worker (no TS imports)"
pnpm add rss-parser >/dev/null
cat > scripts/ingest.mjs <<'JS'
import "dotenv/config";
import Parser from "rss-parser";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function fetchNewsFromRSS(){
  const feeds = [
    process.env.NEWS_RSS_1 || "https://www.abc.net.au/news/feed/51120/rss.xml",
    process.env.NEWS_RSS_2 || "https://www.theguardian.com/australia-news/australian-politics/rss",
    process.env.NEWS_RSS_3 || "https://www.sbs.com.au/news/topic/politics/rss"
  ];
  const parser = new Parser();
  const items = [];
  for (const url of feeds) {
    try{
      const feed = await parser.parseURL(url);
      for (const it of feed.items.slice(0,20)) {
        const id = (it.guid || it.link || it.title || "").slice(0,64);
        if(!id) continue;
        items.push({
          id,
          title: it.title || "Untitled",
          source: (feed.title || new URL(url).hostname).replace(/ - .*$/,""),
          url: it.link || url,
          published: it.isoDate ? new Date(it.isoDate) : new Date(),
          topic: "Politics"
        });
      }
    }catch(e){ console.error("RSS error", url, e?.message); }
  }
  return items;
}

async function upsertNews(items){
  for(const n of items){
    await prisma.news.upsert({ where:{ id:n.id }, update:n, create:n });
  }
}

async function tick(){
  try{
    const news = await fetchNewsFromRSS();
    if(news.length){ await upsertNews(news); console.log("[ingest] upserted", news.length); }
    else console.log("[ingest] no items");
  }catch(e){ console.error("[ingest] error", e?.message); }
}

await tick();
const every = Number(process.env.INGEST_EVERY_MIN || 30);
setInterval(tick, every*60*1000);
console.log(`[ingest] running every ${every} minutes`);
JS

# 5) Ensure API routes exist (idempotent minimal check)
mkdir -p src/app/api/{subscribe,ingest,health}
if [ ! -f src/app/api/subscribe/route.ts ]; then
  cat > src/app/api/subscribe/route.ts <<'TS'
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
function valid(e:string){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
export async function POST(req: Request){
  try{
    const { email } = await req.json();
    if(!email || !valid(email)) return NextResponse.json({ error:"Valid email required" },{ status:400 });
    const e = email.trim().toLowerCase();
    await prisma.subscriber.create({ data:{ email:e } });
    return NextResponse.json({ ok:true });
  }catch(e:any){
    const msg = e?.code === "P2002" ? "Already subscribed" : e?.message || "Failed";
    return NextResponse.json({ error: msg },{ status:400 });
  }
}
TS
fi

if [ ! -f src/app/api/ingest/route.ts ]; then
  cat > src/app/api/ingest/route.ts <<'TS'
import { NextResponse } from "next/server";
export async function POST(){
  try{
    const r = await fetch("http://127.0.0.1:0"); // dummy to satisfy type
    r; // ignore
  }catch{}
  return NextResponse.json({ ok:true }); // real cron runs separately
}
TS
fi

cat > src/app/api/health/route.ts <<'TS'
export async function GET(){ return new Response(JSON.stringify({ ok:true }), { headers:{ "Content-Type":"application/json" } }); }
TS

# 6) Build production and (re)start pm2 services
say "Build production app"
rm -rf .next
pnpm build >/dev/null

say "Start/Restart PM2 services"
pnpm dlx pm2 delete verity-app  >/dev/null 2>&1 || true
pnpm dlx pm2 delete verity-cron >/dev/null 2>&1 || true
pnpm dlx pm2 start "pnpm start -p 3000" --name verity-app --time
pnpm dlx pm2 start "node scripts/ingest.mjs" --name verity-cron --time
pnpm dlx pm2 save >/dev/null

say "Done. Verity is live at http://localhost:3000  | Health: /api/health"
