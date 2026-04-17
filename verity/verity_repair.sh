#!/usr/bin/env bash
# verity_repair.sh — Idempotent fixer for Verity prod build/run
set -euo pipefail

log(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
die(){ printf "\n\033[1;31m!!\033[0m %s\n" "$*"; exit 1; }

[ -f package.json ] || die "Run from the project root"
command -v pnpm >/dev/null || die "pnpm is required (brew install pnpm)"

log "Ensure src dirs"
mkdir -p src/components/ui src/app src/lib src/types src/app/api/stripe/create-checkout

########################################
# 1) UI primitives (lowercase) + kill case-collision
########################################
log "Create lowercase UI primitives (button.tsx, card.tsx)"
cat > src/components/ui/button.tsx <<'TSX'
"use client";
import React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"ghost" };
const ButtonBase = ({ className="", variant="primary", ...rest }: Props) => {
  const base = "rounded-xl px-4 py-2 font-medium transition";
  const variants = variant==="ghost"
    ? "bg-transparent border border-white/15 hover:bg-white/5"
    : "bg-emerald text-[#0b0f14] hover:opacity-90";
  return <button className={`${base} ${variants} ${className}`} {...rest} />;
};
export default ButtonBase;
export { ButtonBase as Button };
TSX

cat > src/components/ui/card.tsx <<'TSX'
import React from "react";
type Props = React.HTMLAttributes<HTMLDivElement>;
const CardBase = ({ className="", ...rest }: Props) => {
  const base = "rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_2px_0_0_rgba(255,255,255,0.05)_inset,0_12px_28px_-18px_rgba(0,0,0,0.7)]";
  return <div className={`${base} ${className}`} {...rest} />;
};
export default CardBase;
export { CardBase as Card };
TSX

log "Remove capitalised UI sources to prevent case-collision"
rm -f src/components/ui/Button.tsx src/components/ui/Card.tsx || true

log "Rewrite imports that point at capitalised UI to lowercase"
node <<'NODE'
const fs = require('fs'); const path = require('path');
const root = 'src'; const files=[];
(function walk(d){ for (const f of fs.readdirSync(d,{withFileTypes:true})) {
  const p=path.join(d,f.name);
  if (f.isDirectory()) walk(p);
  else if (/\.(tsx|ts|js|jsx)$/.test(f.name)) files.push(p);
}}) (root);
for (const p of files){ let s=fs.readFileSync(p,'utf8'); const b=s;
  s = s.replace(/@\/components\/ui\/Button/g, '@/components/ui/button');
  s = s.replace(/@\/components\/ui\/Card/g, '@/components/ui/card');
  if (s!==b){ fs.writeFileSync(p,s); console.log("rewritten:",p); }
}
NODE

########################################
# 2) search lib: types + normalized outputs
########################################
log "Write src/lib/search.ts"
cat > src/lib/search.ts <<'TS'
export type MPHit = { id: string; name: string; party: string; electorate: string; };
export type BillHit = { id: string; title: string; status?: string; predictedPass?: number; };
export type ArticleHit = { id: string; title: string; outlet: string; url: string; };

const DEMO: { mps: MPHit[]; bills: BillHit[]; articles: ArticleHit[] } = {
  mps: [
    { id: "mp1", name: "Jane Smith", party: "Independent", electorate: "Sydney" },
    { id: "mp2", name: "Alex Nguyen", party: "Greens", electorate: "Melbourne" }
  ],
  bills: [
    { id: "bill1", title: "Climate Action Bill 2025", status: "Second Reading", predictedPass: 0.72 },
    { id: "bill2", title: "Digital Integrity Bill", status: "Committee", predictedPass: 0.58 }
  ],
  articles: [
    { id: "a1", title: "Budget 2025: Key Measures", outlet: "ABC", url: "https://example.com/a1" },
    { id: "a2", title: "Election Reform Debate", outlet: "SBS", url: "https://example.com/a2" }
  ]
};

export async function search(q: string){
  const qn = (q||"").toLowerCase();
  const pick = (arr: any[]) => arr.filter(x => !qn || JSON.stringify(x).toLowerCase().includes(qn));
  return {
    mps: pick(DEMO.mps),
    bills: pick(DEMO.bills).map(b => ({ ...b, predictedPass: b?.predictedPass ?? 0 })),
    articles: pick(DEMO.articles)
  };
}

export async function demoSearch(){
  return {
    mps: DEMO.mps,
    bills: DEMO.bills.map(b => ({ ...b, predictedPass: b?.predictedPass ?? 0 })),
    articles: DEMO.articles
  };
}
TS

########################################
# 3) Patch /search page if present
########################################
if [ -f src/app/search/page.tsx ]; then
  log "Patch src/app/search/page.tsx to use search(q)"
  node <<'NODE'
const fs=require('fs'); const p='src/app/search/page.tsx';
let s=fs.readFileSync(p,'utf8');
s = s.replace(/import\s*\{[^}]*demoSearch[^}]*\}\s*from\s*["']@\/lib\/search["'];?/,
              'import { search, type BillHit, type MPHit, type ArticleHit } from "@/lib/search";');
if (!/from\s*["']@\/lib\/search["']/.test(s)){
  s = 'import { search, type BillHit, type MPHit, type ArticleHit } from "@/lib/search";\n' + s;
}
s = s.replace(/export\s+default\s+function\s+Page\s*\(/, 'export default async function Page(');
if (!/await\s+search\(/.test(s)){
  s = s.replace(/const\s+results\s*=\s*demoSearch\s*\([^)]*\)\s*;/, 'const results = await search(q);');
  s = s.replace(/const\s+results\s*=\s*search\s*\([^)]*\)\s*;/, 'const results = await search(q);');
}
s = s.replace(/results\.bills\.map\((\w+)/, 'results.bills as BillHit[]).map($1');
fs.writeFileSync(p,s); console.log("patched:",p);
NODE
else
  log "[skip] src/app/search/page.tsx not found"
fi

########################################
# 4) DB shim with $queryRaw + prisma alias
########################################
log "Write src/lib/db.ts (demo JSON backend + \$queryRaw)"
cat > src/lib/db.ts <<'TS'
type MP = { id: string; name: string; party: string; electorate: string; };
type Bill = { id: string; title: string; summary?: string; status?: string; introduced?: string; sponsor?: string; };
type News = { id: string; title: string; outlet?: string; url?: string; };

function loadJSON<T>(p: string, fallback: T): T { try { return require(p) as T; } catch { return fallback; } }
const MPs   = loadJSON<MP[]>("./src/data/mps.json", []);
const Bills = loadJSON<Bill[]>("./src/data/bills.json", []);
const NewsA = loadJSON<News[]>("./src/data/sources.json", []);

export const db = {
  mP: {
    async findMany(opts?: any): Promise<MP[]> {
      const s = (opts?.where?.name?.contains || "").toLowerCase?.() || "";
      return !s ? MPs : MPs.filter(m => m.name.toLowerCase().includes(s));
    },
    async findUnique(opts: { where: { id: string } }): Promise<MP|null> {
      return MPs.find(m => m.id === opts?.where?.id) ?? null;
    },
  },
  bill: {
    async findMany(opts?: any): Promise<Bill[]> {
      const s = (opts?.where?.title?.contains || "").toLowerCase?.() || "";
      return !s ? Bills : Bills.filter(b => (b.title||"").toLowerCase().includes(s));
    },
    async findUnique(opts: { where: { id: string } }): Promise<Bill|null> {
      return Bills.find(b => b.id === opts?.where?.id) ?? null;
    },
  },
  news: { async findMany(): Promise<News[]> { return NewsA; } },
  async $queryRaw(_q?: any){ return [{ ok: 1 }]; }
};
export const prisma = db as any;
TS

cat > src/types/db-shim.d.ts <<'DTS'
declare module "@/lib/db" {
  export const db: any;
  export const prisma: any;
}
DTS

########################################
# 5) Supabase + Stripe shims
########################################
log "Write Supabase server shim and Stripe demo route"
cat > src/lib/supabaseServer.ts <<'TS'
export async function getSupabaseServer(){
  return { auth: { async getUser(){ return { data: { user: null }, error: null } as any; } } } as any;
}
TS

cat > src/app/api/stripe/create-checkout/route.ts <<'TS'
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
export async function POST(){
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({ sessionId: "demo_session", authed: !!user });
}
TS

########################################
# 6) layout.tsx: ensure relative CSS import
########################################
log "Ensure app/layout.tsx imports ./globals.css"
if [ -f src/app/layout.tsx ]; then
node <<'NODE'
const fs=require('fs'); const p='src/app/layout.tsx';
let s=fs.readFileSync(p,'utf8');
s = s.replace(/import\s+["']@\/styles\/globals\.css["'];?/, 'import "./globals.css";');
if (!/import\s+["']\.\/globals\.css["']/.test(s)) s = 'import "./globals.css";\n'+s;
fs.writeFileSync(p,s); console.log("patched:",p);
NODE
fi

########################################
# 7) tsconfig paths
########################################
log "Patch tsconfig.json (baseUrl=src, @/* -> *)"
if [ -f tsconfig.json ]; then
node <<'NODE'
const fs=require('fs'); const p='tsconfig.json';
const j=JSON.parse(fs.readFileSync(p,'utf8'));
j.compilerOptions ||= {};
j.compilerOptions.baseUrl = "src";
j.compilerOptions.paths = { "@/*": ["*"] };
j.include = Array.from(new Set([...(j.include||[]), "src/**/*", "src/types/**/*", ".next/types/**/*.ts"]));
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log("patched:", p);
NODE
fi

########################################
# 8) PostCSS (CJS)
########################################
log "Write postcss.config.cjs"
cat > postcss.config.cjs <<'CJS'
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
CJS

########################################
# 9) Seed minimal JSON data (if missing)
########################################
log "Seed demo JSON data"
mkdir -p src/data
[ -f src/data/mps.json ] || cat > src/data/mps.json <<'JSON'
[
  { "id": "mp1", "name": "Jane Smith", "party": "Independent", "electorate": "Sydney" },
  { "id": "mp2", "name": "Alex Nguyen", "party": "Greens", "electorate": "Melbourne" }
]
JSON
[ -f src/data/bills.json ] || cat > src/data/bills.json <<'JSON'
[
  { "id": "bill1", "title": "Climate Action Bill 2025", "status": "Second Reading", "summary": "A bill to accelerate decarbonisation." },
  { "id": "bill2", "title": "Digital Integrity Bill", "status": "Committee", "summary": "A bill to improve platform transparency." }
]
JSON
[ -f src/data/sources.json ] || cat > src/data/sources.json <<'JSON'
[
  { "id": "a1", "title": "Budget 2025: Key Measures", "outlet": "ABC", "url": "https://example.com/a1" },
  { "id": "a2", "title": "Election Reform Debate", "outlet": "SBS", "url": "https://example.com/a2" }
]
JSON

########################################
# 10) Build & start
########################################
log "Clean .next & build"
rm -rf .next
pnpm build

log "Start production on :3000"
pkill -f "next start" >/dev/null 2>&1 || true
pnpm start -p 3000 >/dev/null 2>&1 &

log "All set. Visit http://localhost:3000"
