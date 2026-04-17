#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
fail(){ printf "\n\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }
[ -f package.json ] || fail "Run in the project root."

###############################################################################
# 1) Ensure tsconfig resolves "@/..." -> "src/..."
###############################################################################
say "Patch tsconfig aliases for '@/...'"
if [ -f tsconfig.json ]; then
  node <<'NODE'
  import fs from 'fs';
  const p='tsconfig.json'; const j=JSON.parse(fs.readFileSync(p,'utf8'));
  j.compilerOptions ||= {};
  j.compilerOptions.baseUrl = j.compilerOptions.baseUrl || ".";
  j.compilerOptions.paths ||= {};
  // Core alias: everything under @/* maps to src/*
  j.compilerOptions.paths["@/*"] = ["src/*"];
  // Explicit mappings for both capitalized and lowercase UI paths
  j.compilerOptions.paths["@/components/ui/Button"] = ["src/components/ui/Button.tsx"];
  j.compilerOptions.paths["@/components/ui/button"] = ["src/components/ui/button.tsx"];
  j.compilerOptions.paths["@/components/ui/Card"]   = ["src/components/ui/Card.tsx"];
  j.compilerOptions.paths["@/components/ui/card"]   = ["src/components/ui/card.tsx"];
  fs.writeFileSync(p, JSON.stringify(j,null,2));
  console.log("patched:", p);
NODE
else
  cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "es2021"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/ui/Button": ["src/components/ui/Button.tsx"],
      "@/components/ui/button": ["src/components/ui/button.tsx"],
      "@/components/ui/Card":   ["src/components/ui/Card.tsx"],
      "@/components/ui/card":   ["src/components/ui/card.tsx"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src/**/*", ".next/types/**/*.ts", "next.config.js", "tailwind.config.js"],
  "exclude": ["node_modules"]
}
JSON
fi

###############################################################################
# 2) Single source of truth for UI primitives; dual file names re-export it
###############################################################################
say "Create unified UI primitives and re-exports (both casings)"
mkdir -p src/components/ui

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

# Lowercase re-exports
cat > src/components/ui/button.tsx <<'TSX'
"use client";
export { UIButton as default, UIButton as Button } from "./atoms";
TSX
cat > src/components/ui/card.tsx <<'TSX'
export { UICard as default, UICard as Card } from "./atoms";
TSX

# Capitalized re-exports (to satisfy imports using capitalized path)
cat > src/components/ui/Button.tsx <<'TSX'
"use client";
export { UIButton as default, UIButton as Button } from "./atoms";
TSX
cat > src/components/ui/Card.tsx <<'TSX'
export { UICard as default, UICard as Card } from "./atoms";
TSX

###############################################################################
# 3) Clean build & restart PM2
###############################################################################
say "Rebuild production bundle"
rm -rf .next
pnpm build >/dev/null

say "Restart PM2 (app + cron)"
pnpm dlx pm2 delete verity-app  >/dev/null 2>&1 || true
pnpm dlx pm2 delete verity-cron >/dev/null 2>&1 || true
pnpm dlx pm2 start "pnpm start -p 3000" --name verity-app --time
pnpm dlx pm2 start "node scripts/ingest.mjs" --name verity-cron --time
pnpm dlx pm2 save >/dev/null

say "Done. Visit http://localhost:3000  | Health: /api/health"
