#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
fail(){ printf "\n\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }

[ -f package.json ] || fail "Run in project root."

###############################################################################
# 1) UI: keep lowercase files, alias capitalized paths to them
###############################################################################
say "Normalize UI components to lowercase and alias capitalized imports"

mkdir -p src/components/ui

# Implement lowercase versions (authoritative)
cat > src/components/ui/card.tsx <<'TSX'
import React from "react";
export type CardProps = { className?: string; children: React.ReactNode };
export default function Card({ className="", children }: CardProps){
  return <div className={`card rounded-2xl border border-white/10 bg-white/5 ${className}`}>{children}</div>;
}
export const Card = Card;
TSX

cat > src/components/ui/button.tsx <<'TSX'
"use client";
import React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"ghost"|"outline" };
export default function Button({ variant="primary", className="", ...props }: Props){
  const base="btn rounded-xl px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald/60";
  const v = variant==="primary" ? "bg-emerald text-[#0b0f14]" :
            variant==="ghost"   ? "bg-transparent hover:bg-white/5" :
                                  "border border-white/10 hover:bg-white/5";
  return <button className={`${base} ${v} ${className}`} {...props} />;
}
export const Button = Button;
TSX

# Remove capitalized duplicates to avoid case-collision on macOS file system.
# (If these paths don't exist, it's fine.)
rm -f src/components/ui/Card.tsx || true
rm -f src/components/ui/Button.tsx || true

# Add tsconfig path aliases so imports like '@/components/ui/Card' resolve to lowercase file.
if [ -f tsconfig.json ]; then
  node <<'NODE'
  import fs from 'fs';
  const p='tsconfig.json';
  const j=JSON.parse(fs.readFileSync(p,'utf8'));
  j.compilerOptions ||= {};
  j.compilerOptions.baseUrl ||= ".";
  j.compilerOptions.paths ||= {};
  // Keep your existing "@/..." alias working
  if (!j.compilerOptions.paths["@/*"]) j.compilerOptions.paths["@/*"]=["src/*"];
  // Capitalized UI proxies -> lowercase files
  j.compilerOptions.paths["@/components/ui/Card"]   = ["src/components/ui/card.tsx"];
  j.compilerOptions.paths["@/components/ui/Button"] = ["src/components/ui/button.tsx"];
  fs.writeFileSync(p, JSON.stringify(j,null,2));
  console.log("patched:", p);
NODE
fi

###############################################################################
# 2) API route type fixes (loosen context param typing)
###############################################################################
say "Loosen Next.js route function typings to avoid invalid export errors"

fix_route() {
  local file="$1"
  if [ -f "$file" ]; then
    cat > "$file" <<'TS'
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET(_req: Request, ctx: any){
  const id = ctx?.params?.id;
  if (!id) return new NextResponse("Bad Request", { status: 400 });
  // Decide which model based on path segment (bills or mps)
  if (typeof id !== "string") return new NextResponse("Bad Request", { status: 400 });
  try{
    if (__filename.includes("/bills/")) {
      const bill = await db.bill.findUnique({ where:{ id } });
      return bill ? NextResponse.json(bill) : new NextResponse("Not found", { status:404 });
    } else {
      const mp = await db.mP.findUnique({ where:{ id } });
      return mp ? NextResponse.json(mp) : new NextResponse("Not found", { status:404 });
    }
  }catch(e:any){
    return new NextResponse(e?.message||"error",{ status:500 });
  }
}
TS
  fi
}

fix_route "src/app/api/bills/[id]/route.ts"
fix_route "src/app/api/mps/[id]/route.ts"

###############################################################################
# 3) search lib: add demoSearch alongside search()
###############################################################################
say "Add demoSearch export so /search page builds"

mkdir -p src/lib
cat > src/lib/search.ts <<'TS'
import { db } from "./db";
export async function search(q:string){
  const term = q.trim();
  if(!term) return { mps:[], bills:[], news:[] };
  const [mps,bills,news] = await Promise.all([
    db.mP.findMany({ where:{ OR:[{name:{contains:term, mode:"insensitive"}},{electorate:{contains:term,mode:"insensitive"}},{party:{contains:term,mode:"insensitive"}}] }, take:10 }),
    db.bill.findMany({ where:{ OR:[{title:{contains:term, mode:"insensitive"}},{summary:{contains:term,mode:"insensitive"}}] }, orderBy:{ introduced:"desc" }, take:10 }),
    db.news.findMany({ where:{ OR:[{title:{contains:term, mode:"insensitive"}},{source:{contains:term,mode:"insensitive"}}] }, orderBy:{ published:"desc" }, take:10 }),
  ]);
  return { mps,bills,news };
}

// Minimal demoSearch for pages that expect a canned response when q is empty
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
# 4) Clean build and restart PM2
###############################################################################
say "Rebuild production bundle (case-collision resolved, routes/types fixed)"
rm -rf .next
pnpm build >/dev/null

say "Restart PM2 services"
pnpm dlx pm2 delete verity-app  >/dev/null 2>&1 || true
pnpm dlx pm2 delete verity-cron >/dev/null 2>&1 || true
pnpm dlx pm2 start "pnpm start -p 3000" --name verity-app --time
pnpm dlx pm2 start "node scripts/ingest.mjs" --name verity-cron --time
pnpm dlx pm2 save >/dev/null

say "Done. Visit http://localhost:3000  | Health: /api/health"
