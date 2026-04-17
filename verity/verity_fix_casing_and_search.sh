#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
fail(){ printf "\n\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }
[ -f package.json ] || fail "Run in the project root."

###############################################################################
# 1) Keep ONLY lowercase ui primitives; delete capitalised duplicates
###############################################################################
say "Remove capitalised UI files to avoid case-collision"
rm -f src/components/ui/Button.tsx 2>/dev/null || true
rm -f src/components/ui/Card.tsx   2>/dev/null || true

# Ensure lowercase ui files exist (authoritative)
mkdir -p src/components/ui
if [ ! -f src/components/ui/atoms.tsx ]; then
  cat > src/components/ui/atoms.tsx <<'TSX'
import React from "react";
/** Button */
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};
export function UIButton({ variant="primary", className="", ...props }: ButtonProps){
  const base = "btn rounded-xl px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald/60";
  const v = variant==="primary" ? "bg-emerald text-[#0b0f14]" :
            variant==="ghost"   ? "bg-transparent hover:bg-white/5" :
                                  "border border-white/10 hover:bg-white/5";
  return <button className={`${base} ${v} ${className}`} {...props} />;
}
/** Card */
export type CardProps = { className?: string; children: React.ReactNode };
export function UICard({ className="", children }: CardProps){
  return <div className={`card rounded-2xl border border-white/10 bg-white/5 ${className}`}>{children}</div>;
}
TSX
fi
cat > src/components/ui/button.tsx <<'TSX'
"use client";
export { UIButton as default, UIButton as Button } from "./atoms";
TSX
cat > src/components/ui/card.tsx <<'TSX'
export { UICard as default, UICard as Card } from "./atoms";
TSX

###############################################################################
# 2) Force tsconfig to map both casings to lowercase files
###############################################################################
say "Patch tsconfig so '@/components/ui/Button' & '.../Card' resolve to lowercase files"
node <<'NODE'
import fs from 'fs';
const p='tsconfig.json';
const j=JSON.parse(fs.readFileSync(p,'utf8'));
j.compilerOptions ||= {};
j.compilerOptions.baseUrl = j.compilerOptions.baseUrl || ".";
j.compilerOptions.paths ||= {};
j.compilerOptions.paths["@/*"] = ["src/*"];
j.compilerOptions.paths["@/components/ui/Button"] = ["src/components/ui/button.tsx"];
j.compilerOptions.paths["@/components/ui/Card"]   = ["src/components/ui/card.tsx"];
j.compilerOptions.paths["@/components/ui/button"] = ["src/components/ui/button.tsx"];
j.compilerOptions.paths["@/components/ui/card"]   = ["src/components/ui/card.tsx"];
// ensure Next plugin entry is present to silence warnings (optional)
j.compilerOptions.plugins = Array.isArray(j.compilerOptions.plugins) ? j.compilerOptions.plugins : [];
if (!j.compilerOptions.plugins.find(p=>p && p.name==="next")) j.compilerOptions.plugins.push({ name: "next" });
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log("patched:", p);
NODE

###############################################################################
# 3) Restore lib/search.ts so /api/ask can import it
###############################################################################
say "Write src/lib/search.ts"
mkdir -p src/lib
cat > src/lib/search.ts <<'TS'
import { db } from "./db";

export async function search(q:string){
  const term = (q||"").trim();
  if(!term) return { mps:[], bills:[], news:[] };
  const [mps,bills,news] = await Promise.all([
    db.mP.findMany({
      where:{ OR:[
        { name:{ contains:term, mode:"insensitive" } },
        { electorate:{ contains:term, mode:"insensitive" } },
        { party:{ contains:term, mode:"insensitive" } },
      ]}, take:10
    }),
    db.bill.findMany({
      where:{ OR:[
        { title:{ contains:term, mode:"insensitive" } },
        { summary:{ contains:term, mode:"insensitive" } },
      ]}, orderBy:{ introduced:"desc" }, take:10
    }),
    db.news.findMany({
      where:{ OR:[
        { title:{ contains:term, mode:"insensitive" } },
        { source:{ contains:term, mode:"insensitive" } },
      ]}, orderBy:{ published:"desc" }, take:10
    }),
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

###############################################################################
# 4) Clean build & restart PM2
###############################################################################
say "Rebuild production bundle (no case-collision, search present)"
rm -rf .next
pnpm build >/dev/null

say "Restart PM2 (app + cron)"
pnpm dlx pm2 delete verity-app  >/dev/null 2>&1 || true
pnpm dlx pm2 delete verity-cron >/dev/null 2>&1 || true
pnpm dlx pm2 start "pnpm start -p 3000" --name verity-app --time
pnpm dlx pm2 start "node scripts/ingest.mjs" --name verity-cron --time
pnpm dlx pm2 save >/dev/null

say "Done. Visit http://localhost:3000  | Health: /api/health"
