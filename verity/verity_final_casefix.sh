#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
fail(){ printf "\n\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }
[ -f package.json ] || fail "Run in project root."

###############################################################################
# 0) Force-delete capitalised UI files and any stale duplicates
###############################################################################
say "Remove capitalised UI sources (Button.tsx/Card.tsx) to kill case-collision"
rm -f src/components/ui/Button.tsx 2>/dev/null || true
rm -f src/components/ui/Card.tsx   2>/dev/null || true

###############################################################################
# 1) Ensure lowercase UI primitives exist
###############################################################################
say "Ensure lowercase UI primitives"
mkdir -p src/components/ui
cat > src/components/ui/atoms.tsx <<'TSX'
import React from "react";
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"ghost"|"outline" };
export function UIButton({ variant="primary", className="", ...props }: ButtonProps){
  const base="btn rounded-xl px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald/60";
  const v = variant==="primary" ? "bg-emerald text-[#0b0f14]" :
            variant==="ghost"   ? "bg-transparent hover:bg-white/5" :
                                  "border border-white/10 hover:bg-white/5";
  return <button className={`${base} ${v} ${className}`} {...props} />;
}
export type CardProps = { className?: string; children: React.ReactNode };
export function UICard({ className="", children }: CardProps){
  return <div className={`card rounded-2xl border border-white/10 bg-white/5 ${className}`}>{children}</div>;
}
TSX
cat > src/components/ui/button.tsx <<'TSX'
"use client";
export { UIButton as default, UIButton as Button } from "./atoms";
TSX
cat > src/components/ui/card.tsx <<'TSX'
export { UICard as default, UICard as Card } from "./atoms";
TSX

###############################################################################
# 2) Rewrite ALL imports in /src that reference capitalised UI paths to lowercase
###############################################################################
say "Rewrite imports to lowercase UI paths across src"
# Use perl for cross-platform in-place edit; handle quotes and named/default imports.
perl -0777 -pe 's{@/components/ui/Button\b}{@/components/ui/button}g' -i $(git ls-files -z -- src | tr -d '\0' || ls -1R src 2>/dev/null | tr "\n" " ")
perl -0777 -pe 's{@/components/ui/Card\b}{@/components/ui/card}g'     -i $(git ls-files -z -- src | tr -d '\0' || ls -1R src 2>/dev/null | tr "\n" " ")
# Also catch relative imports e.g. ../../components/ui/Button
perl -0777 -pe 's{([\"\'\(\s])(\.{1,2}/(?:[^\"\'\)]+/)*components/ui/)Button\b}{$1$2button}g' -i $(git ls-files -z -- src | tr -d '\0' || ls -1R src 2>/dev/null | tr "\n" " ")
perl -0777 -pe 's{([\"\'\(\s])(\.{1,2}/(?:[^\"\'\)]+/)*components/ui/)Card\b}{$1$2card}g'     -i $(git ls-files -z -- src | tr -d '\0' || ls -1R src 2>/dev/null | tr "\n" " ")

###############################################################################
# 3) Lock tsconfig alias so both casings map to lowercase files (belt & braces)
###############################################################################
say "Patch tsconfig aliases"
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
j.compilerOptions.plugins = Array.isArray(j.compilerOptions.plugins) ? j.compilerOptions.plugins : [];
if (!j.compilerOptions.plugins.find(p=>p && p.name==="next")) j.compilerOptions.plugins.push({ name:"next" });
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log("patched:", p);
NODE

###############################################################################
# 4) Ensure lib/search.ts definitely exists (and is discoverable)
###############################################################################
say "Ensure src/lib/search.ts exists"
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

# Type hint to help TS see the module quickly (optional, harmless)
mkdir -p src/types
cat > src/types/modules.d.ts <<'DTS'
declare module "@/lib/search";
DTS

###############################################################################
# 5) Clean build & restart PM2
###############################################################################
say "Clean build"
rm -rf .next
pnpm build >/dev/null

say "Restart PM2 (app + cron)"
pnpm dlx pm2 delete verity-app  >/dev/null 2>&1 || true
pnpm dlx pm2 delete verity-cron >/dev/null 2>&1 || true
pnpm dlx pm2 start "pnpm start -p 3000" --name verity-app --time
pnpm dlx pm2 start "node scripts/ingest.mjs" --name verity-cron --time
pnpm dlx pm2 save >/dev/null

say "Done. Visit http://localhost:3000  | Health: /api/health"
