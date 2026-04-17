#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
fail(){ printf "\n\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }
[ -f package.json ] || fail "Run this in the project root."

###############################################################################
# 1) Ensure '@/lib/db' exports BOTH { db } and { prisma } (alias)
###############################################################################
say "Patch/create src/lib/db.ts to export { db } and { prisma }"
mkdir -p src/lib src/types src/data
# If a db.ts already exists, patch it; otherwise write our shim.
node <<'NODE'
import fs from 'fs'; import path from 'path';
const p = path.join('src','lib','db.ts');
let s = fs.existsSync(p) ? fs.readFileSync(p,'utf8') : '';
if (!s) {
  s = `import fs from "fs"; import path from "path";
type MP = { id: string; name: string; party: string; electorate: string };
type Bill = { id: string; title: string; summary: string; status: string; introduced: string; sponsor?: string|null };
type News = { id: string; title: string; source: string; url?: string; published: string; summary?: string };
function readJson<T>(file:string, fallback:T):T{ try{ return JSON.parse(fs.readFileSync(path.join(process.cwd(),"src","data",file),"utf8")) }catch{ return fallback } }
const MPS:MP[]   = readJson("mps.json", []);
const BILLS:Bill[]= readJson("bills.json", []);
const NEWS:News[] = readJson("news.json", [{id:"n-1",title:"Welcome to Verity",source:"Verity",published:new Date().toISOString()}]);
function containsCI(v:any, q:string){ return typeof v==="string" && v.toLowerCase().includes(q.toLowerCase()) }
function order<T>(arr:T[], key:keyof T, dir:"asc"|"desc"){ return [...arr].sort((a:any,b:any)=>{const A=a[key],B=b[key]; const isD=(x:any)=> typeof x==="string" && /\\d{4}-\\d{2}-\\d{2}T/.test(x); const AA=isD(A)?Date.parse(A):A; const BB=isD(B)?Date.parse(B):B; const c=AA<BB?-1:AA>BB?1:0; return dir==="asc"?c:-c;}); }
type FindMany<T>={ where?:{ OR?: Array<Record<string,{contains:string;mode?:"insensitive"}>> }, orderBy?:Record<string,"asc"|"desc">, take?:number };
type FindUnique<T>={ where:{ id:string } };
function filter<T extends Record<string,any>>(rows:T[], where?:FindMany<T>["where"]){ if(!where?.OR?.length) return rows; return rows.filter(r=> where!.OR!.some(cond=> Object.entries(cond).some(([f,s])=> containsCI(r[f], s.contains)))) }
export const db = {
  mP:{ async findMany(o:FindMany<MP>={}){ let out=filter<MP>(MPS,o.where); if(o.orderBy){const [k,d]=Object.entries(o.orderBy)[0] as [keyof MP,"asc"|"desc"]; out=order(out,k,d);} if(o.take) out=out.slice(0,o.take); return out; }, async findUnique(o:FindUnique<MP>){ return MPS.find(m=>m.id===o.where.id)||null; } },
  bill:{ async findMany(o:FindMany<Bill>={}){ let out=filter<Bill>(BILLS,o.where); if(o.orderBy){const [k,d]=Object.entries(o.orderBy)[0] as [keyof Bill,"asc"|"desc"]; out=order(out,k,d);} if(o.take) out=out.slice(0,o.take); return out; }, async findUnique(o:FindUnique<Bill>){ return BILLS.find(b=>b.id===o.where.id)||null; } },
  news:{ async findMany(o:FindMany<News>={}){ let out=filter<News>(NEWS,o.where); if(o.orderBy){const [k,d]=Object.entries(o.orderBy)[0] as [keyof News,"asc"|"desc"]; out=order(out,k,d);} if(o.take) out=out.slice(0,o.take); return out; } },
};
export const prisma = db; // alias for legacy imports
export default db;`;
  fs.writeFileSync(p, s);
} else {
  // Ensure named export prisma exists as alias to db
  if (!/export\s+const\s+prisma\s*=/.test(s)) {
    if (/export\s+default\s+db/.test(s) && /export\s+const\s+db/.test(s)) {
      s += `\nexport const prisma = db;\n`;
    } else if (/export\s+default\s+db/.test(s)) {
      s = s.replace(/export\s+default\s+db\s*;?/, 'export const db = db;\nexport const prisma = db;\nexport default db;');
    } else if (/export\s+const\s+db/.test(s)) {
      s += `\nexport const prisma = db;\n`;
    } else {
      s += `\nexport const prisma = db as any;\nexport default db as any;\n`;
    }
    fs.writeFileSync(p, s);
  }
}
NODE

# Types (keep TS happy)
cat > src/types/db-shim.d.ts <<'DTS'
declare module "@/lib/db" {
  export type MP = { id: string; name: string; party: string; electorate: string };
  export type Bill = { id: string; title: string; summary: string; status: string; introduced: string; sponsor?: string | null };
  export type News = { id: string; title: string; source: string; url?: string; published: string; summary?: string };
  export const db: {
    mP: { findMany(opts?: any): Promise<MP[]>; findUnique(opts: { where: { id: string } }): Promise<MP|null> };
    bill: { findMany(opts?: any): Promise<Bill[]>; findUnique(opts: { where: { id: string } }): Promise<Bill|null> };
    news: { findMany(opts?: any): Promise<News[]> };
  };
  export const prisma: typeof db;
  export default db;
}
DTS

###############################################################################
# 2) Kill accidental duplicate tree 'src/src/**' so aliases never resolve there
###############################################################################
if [ -d src/src ]; then
  say "Remove stray src/src duplicate tree"
  rm -rf src/src
fi

###############################################################################
# 3) Provide '@/lib/briefings' with getBriefing()
###############################################################################
say "Write src/lib/briefings.ts (getBriefing)"
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

###############################################################################
# 4) Pin path aliases strictly to 'src/*' (belt & braces)
###############################################################################
say "Pin tsconfig paths to only src/*"
node <<'NODE'
import fs from 'fs';
const p='tsconfig.json';
const j=JSON.parse(fs.readFileSync(p,'utf8'));
j.compilerOptions ||= {};
j.compilerOptions.baseUrl = ".";
j.compilerOptions.paths = { "@/*": ["src/*"] }; // make exclusive
j.compilerOptions.plugins = Array.isArray(j.compilerOptions.plugins) ? j.compilerOptions.plugins : [];
if (!j.compilerOptions.plugins.find(x=>x && x.name==="next")) j.compilerOptions.plugins.push({ name:"next" });
const inc = new Set([...(j.include||[]), "src/**/*", ".next/types/**/*.ts", "next-env.d.ts", "src/types/**/*.d.ts"]);
j.include = Array.from(inc);
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log("patched:", p);
NODE

###############################################################################
# 5) Clean build & start production server on :3000
###############################################################################
say "Clean Next cache & build"
rm -rf .next
pnpm build

say "Start production server on :3000"
pkill -f "next start" 2>/dev/null || true
pnpm start -p 3000 &
sleep 2
say "Done. Open http://localhost:3000"
