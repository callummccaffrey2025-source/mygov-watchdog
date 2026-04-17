#!/usr/bin/env bash
set -euo pipefail

say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
[ -f package.json ] || { echo "[fail] Run this in the project root"; exit 1; }

###############################################################################
# 4) Re-create DB shim (db + prisma alias + $queryRaw) and types
###############################################################################
say "Create DB shim with queryRaw and prisma alias"
mkdir -p src/lib src/types

cat > src/lib/db.ts <<'TS'
import fs from "fs"; import path from "path";
export type MP = { id: string; name: string; party: string; electorate: string };
export type Bill = { id: string; title: string; summary: string; status: string; introduced: string; sponsor?: string|null };
export type News = { id: string; title: string; source: string; url?: string; published: string; summary?: string };

function readJson<T>(file:string, fallback:T):T {
  const p = path.join(process.cwd(),"src","data",file);
  try { return JSON.parse(fs.readFileSync(p,"utf8")) as T; } catch { return fallback; }
}
let MPS:MP[] = readJson("mps.json",[]);
let BILLS:Bill[] = readJson("bills.json",[]);
let NEWS:News[] = readJson("news.json",[]);

function containsCI(v:unknown, q:string){ return typeof v==="string" && v.toLowerCase().includes(q.toLowerCase()); }
function order<T extends Record<string,any>>(arr:T[], key:keyof T, dir:"asc"|"desc"){
  return [...arr].sort((a,b)=>{
    const A = typeof a[key]==="string" && /\d{4}-\d{2}-\d{2}T/.test(a[key]) ? Date.parse(a[key]) : (a as any)[key];
    const B = typeof b[key]==="string" && /\d{4}-\d{2}-\d{2}T/.test(b[key]) ? Date.parse(b[key]) : (b as any)[key];
    const c = A<B?-1:A>B?1:0; return dir==="asc"?c:-c;
  });
}
type FindMany<T> = { where?:{ OR?: Array<Record<string,{contains:string;mode?:"insensitive"}>> }, orderBy?:Record<string,"asc"|"desc">, take?:number };
type FindUnique<T> = { where:{ id:string } };
function applyWhere<T extends Record<string,any>>(rows:T[], where?:FindMany<T>["where"]){
  if(!where?.OR?.length) return rows;
  return rows.filter(r => where!.OR!.some(cond => Object.entries(cond).some(([f,s]) => containsCI(r[f], s.contains))));
}

async function __rawTag(_strings: TemplateStringsArray, ..._values: any[]): Promise<any> { return 1; }

export const db = {
  $queryRaw: __rawTag,
  mP: {
    async findMany(o:FindMany<MP>={}){ let out=applyWhere<MP>(MPS,o.where); if(o.orderBy){const [k,d]=Object.entries(o.orderBy)[0] as [keyof MP,"asc"|"desc"]; out=order(out,k,d);} if(o.take) out=out.slice(0,o.take); return out; },
    async findUnique(o:FindUnique<MP>){ return MPS.find(m=>m.id===o.where.id)||null; },
  },
  bill: {
    async findMany(o:FindMany<Bill>={}){ let out=applyWhere<Bill>(BILLS,o.where); if(o.orderBy){const [k,d]=Object.entries(o.orderBy)[0] as [keyof Bill,"asc"|"desc"]; out=order(out,k,d);} if(o.take) out=out.slice(0,o.take); return out; },
    async findUnique(o:FindUnique<Bill>){ return BILLS.find(b=>b.id===o.where.id)||null; },
  },
  news: {
    async findMany(o:FindMany<News>={}){ let out=applyWhere<News>(NEWS,o.where); if(o.orderBy){const [k,d]=Object.entries(o.orderBy)[0] as [keyof News,"asc"|"desc"]; out=order(out,k,d);} if(o.take) out=out.slice(0,o.take); return out; },
  },
};
export const prisma = db; // alias for legacy imports
export default db;
TS

cat > src/types/db-shim.d.ts <<'DTS'
declare module "@/lib/db" {
  export type MP = { id: string; name: string; party: string; electorate: string };
  export type Bill = { id: string; title: string; summary: string; status: string; introduced: string; sponsor?: string | null };
  export type News = { id: string; title: string; source: string; url?: string; published: string; summary?: string };
  export const db: {
    $queryRaw(strings: TemplateStringsArray, ...values: any[]): Promise<any>;
    mP: { findMany(opts?: any): Promise<MP[]>; findUnique(opts: { where: { id: string } }): Promise<MP|null> };
    bill: { findMany(opts?: any): Promise<Bill[]>; findUnique(opts: { where: { id: string } }): Promise<Bill|null> };
    news: { findMany(opts?: any): Promise<News[]> };
  };
  export const prisma: typeof db;
  export default db;
}
DTS

###############################################################################
# 5) Supabase server shim + Stripe demo routes (compile-safe)
###############################################################################
say "Ensure Supabase server shim + Stripe demo routes"
mkdir -p src/lib src/app/api/stripe/create-checkout src/app/api/stripe-webhook

cat > src/lib/supabaseServer.ts <<'TS'
export type SupabaseUser = { id?: string; email?: string | null } | null;
export type SupabaseServer = { auth: { getUser: () => Promise<{ data: { user: SupabaseUser } }> } };
export async function getSupabaseServer(): Promise<SupabaseServer> {
  return { auth: { async getUser(){ return { data: { user: null } }; } } };
}
export default getSupabaseServer;
TS

cat > src/app/api/stripe/create-checkout/route.ts <<'TS'
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
export async function POST(){
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({ ok:true, mode:"demo", user: user?.email ?? null, url:"/pricing#demo" });
}
TS

cat > src/app/api/stripe-webhook/route.ts <<'TS'
import { NextResponse } from "next/server";
export async function POST(){ return NextResponse.json({ ok:true, mode:"demo" }); }
TS

###############################################################################
# 6) Search & Briefings libraries (used by /api/ask and /api/briefings)
###############################################################################
say "Ensure search & briefings libs exist"
mkdir -p src/lib

cat > src/lib/search.ts <<'TS'
import { db } from "./db";
export async function search(q:string){
  const term = (q||"").trim();
  if(!term) return { mps:[], bills:[], news:[] };
  const [mps,bills,news] = await Promise.all([
    db.mP.findMany({ where:{ OR:[
      { name:{ contains:term, mode:"insensitive" } },
      { electorate:{ contains:term, mode:"insensitive" } },
      { party:{ contains:term, mode:"insensitive" } },
    ]}, take:10 }),
    db.bill.findMany({ where:{ OR:[
      { title:{ contains:term, mode:"insensitive" } },
      { summary:{ contains:term, mode:"insensitive" } },
    ]}, orderBy:{ introduced:"desc" }, take:10 }),
    db.news.findMany({ where:{ OR:[
      { title:{ contains:term, mode:"insensitive" } },
      { source:{ contains:term, mode:"insensitive" } },
    ]}, orderBy:{ published:"desc" }, take:10 }),
  ]);
  return { mps,bills,news };
}
export async function demoSearch(){
  const [mps,bills,news] = await Promise.all([
    db.mP.findMany({ take:3, orderBy:{ name:"asc" } }),
    db.bill.findMany({ take:3, orderBy:{ introduced:"desc" } }),
    db.news.findMany({ take:6, orderBy:{ published:"desc" } }),
  ]);
  return { mps,bills,news };
}
TS

cat > src/lib/briefings.ts <<'TS'
import { db } from "@/lib/db";
export async function getBriefing(){
  const [topNews, recentBills] = await Promise.all([
    db.news.findMany({ orderBy: { published: "desc" }, take: 6 }),
    db.bill.findMany({ orderBy: { introduced: "desc" }, take: 5 }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    headlines: topNews.map(n => ({ id:n.id, title:n.title, source:n.source, published:n.published, url:(n as any).url })),
    bills: recentBills.map(b => ({ id:b.id, title:b.title, status:b.status, introduced:b.introduced })),
  };
}
TS

# Ensure /api/ask uses relative import if alias is flaky
if [ -f src/app/api/ask/route.ts ]; then
  node <<'NODE'
  import fs from 'fs';
  const p='src/app/api/ask/route.ts';
  if (fs.existsSync(p)) {
    let s = fs.readFileSync(p,'utf8');
    s = s.replace(/from\s+["']@\/lib\/search["']/g, 'from "../../../lib/search"');
    fs.writeFileSync(p,s);
  }
NODE
fi

###############################################################################
# 7) Clean build & start production
###############################################################################
say "Clean Next cache & build"
rm -rf .next
pnpm build

say "Start production server on :3000"
pkill -f "next start" 2>/dev/null || true
pnpm start -p 3000 &
sleep 2
say "Done. Open http://localhost:3000"
