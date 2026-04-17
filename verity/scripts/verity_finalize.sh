#!/usr/bin/env bash
set -euo pipefail

log(){ printf "\n\033[1;96m== %s ==\033[0m\n" "$*"; }
warn(){ printf "\033[1;93mWARN:\033[0m %s\n" "$*"; }
die(){ printf "\033[1;91mERROR:\033[0m %s\n" "$*"; exit 1; }

# 0) Safety branch
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Run inside a git repo."
branch="verity-finalize-$(date +%Y%m%d%H%M)"
git checkout -B "$branch" >/dev/null 2>&1 || true

# 1) Ensure folders
log "Scaffolding missing folders"
mkdir -p \
  lib/supabase src/lib/supabase \
  src/{types,lib/{data},components/{shared,ui,mp,news},hooks,data} \
  components/ui/button components/ui/card \
  src/components/ui/button src/components/ui/card \
  components/ui hooks

# 2) Supabase server helper (compile-safe stub; swap to real cookies later)
log "Writing Supabase server shim (non-breaking, compile-safe)"
cat > lib/supabase/server.ts << "TS"
import { createServerClient, type CookieOptions } from "@supabase/ssr";
/** Minimal server client with no-op cookie store (avoids Next typing mismatch).
 *  Replace with cookies() integration when auth/session wiring is finalized. */
export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(url, anon, {
    cookies: {
      get(_name: string){ return undefined; },
      set(_name: string, _value: string, _opts: CookieOptions){},
      remove(_name: string, _opts: CookieOptions){},
    },
  });
}
TS
cp lib/supabase/server.ts src/lib/supabase/server.ts
echo "export { getSupabaseServer } from ./supabase/server;" > lib/supabaseServer.ts
echo "export { getSupabaseServer } from ./supabase/server;" > src/lib/supabaseServer.ts

# 3) Types & barrels so `@/types` always resolves
log "Ensuring type barrels"
cat > src/types/index.ts << "TS"
export type MP = { id: string; name: string; electorate?: string; party?: string };
export type Bill = { id: string; title: string; stage?: string; progress?: number };
export type NewsItem = { id: string; title: string; url?: string; date?: string };
TS
mkdir -p types
cat > types/index.ts << "TS"
export * from "../src/types";
TS
cat > types.ts << "TS"
export * from "./src/types";
TS
cat > src/lib/types.ts << "TS"
export type { MP, Bill, NewsItem } from "@/types";
TS
cat > lib/types.ts << "TS"
export type { MP, Bill, NewsItem } from "@/types";
TS

# 4) Data + utils used by pages
log "Writing data/utils shims"
cat > src/lib/format.ts << "TS"
export function formatPercent(n?: number) {
  if (typeof n !== "number" || !isFinite(n)) return "0%";
  return \`\${Math.round(n * 100)}%\`;
}
TS
cat > src/lib/data/bills.ts << "TS"
import type { Bill } from "@/lib/types";
export const BILLS: Bill[] = [];
TS
cat > src/lib/data/mps.ts << "TS"
import type { MP } from "@/lib/types";
export const MPS: MP[] = [];
TS
echo "export * from @/lib/data/bills;" > src/data/bills.ts
echo "export * from @/lib/data/mps;" > src/data/mps.ts

# 5) UI components that were missing (exact import paths)
log "Adding UI stubs to satisfy imports"
cat > src/components/shared/Section.tsx << "TSX"
export default function Section({ title, children }:{title?:string; children:React.ReactNode}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      {title && <h2 className="text-xl font-semibold mb-3">{title}</h2>}
      {children}
    </section>
  );
}
TSX
cat > src/components/shared/Empty.tsx << "TSX"
export default function Empty({ children }:{children?:React.ReactNode}) {
  return <div className="text-sm text-neutral-400 border border-white/10 rounded-xl p-6">{children ?? "Nothing to show yet."}</div>;
}
TSX
cat > src/components/ui/progressbar.tsx << "TSX"
export function ProgressBar({ value=0 }:{ value?: number }) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <div className="h-full" style={{ backgroundColor: "rgb(16 185 129)", width: \`\${v}%\` }} />
    </div>
  );
}
TSX
cat > src/components/mp/MPCard.tsx << "TSX"
import type { MP } from "@/types";
export default function MPCard({ mp }:{ mp: MP }) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <div className="font-semibold">{mp.name}</div>
      <div className="text-sm text-neutral-400">{mp.party ?? "Independent"} • {mp.electorate ?? "—"}</div>
    </div>
  );
}
TSX
cat > src/components/news/NewsCard.tsx << "TSX"
import type { NewsItem } from "@/types";
export default function NewsCard({ item }:{ item: NewsItem }) {
  return (
    <a className="block rounded-xl border border-white/10 p-4 hover:border-emerald-400/40" href={item.url ?? "#"} target="_blank" rel="noreferrer">
      <div className="font-medium">{item.title}</div>
      {item.date && <div className="text-xs text-neutral-400">{item.date}</div>}
    </a>
  );
}
TSX
cat > src/components/Stat.tsx << "TSX"
export default function Stat({label,value}:{label?:string;value?:string|number}) {
  return <div className="text-sm text-neutral-300"><span className="text-neutral-500 mr-2">{label ?? "Stat"}</span><span className="font-medium">{value ?? "—"}</span></div>;
}
TSX
cat > src/components/AuthClient.tsx << "TSX"
export default function AuthClient(){ return null }
TSX
cat > src/components/CheckoutButton.tsx << "TSX"
export default function CheckoutButton(){ return null }
TSX
cat > src/components/command-palette.tsx << "TSX"
export default function CommandPalette(){ return null }
TSX

# 6) shadcn: ensure re-export indices exist in both trees
log "Fixing shadcn exports"
cat > components/ui/button/index.tsx << "TS"
export * from "../button";
TS
cat > components/ui/card/index.tsx << "TS"
export * from "../card";
TS
cat > components/ui/index.ts << "TS"
export * from "./button";
export * from "./card";
TS
cat > src/components/ui/button/index.tsx << "TS"
export * from "../button";
TS
cat > src/components/ui/card/index.tsx << "TS"
export * from "../card";
TS
cat > src/components/ui/index.ts << "TS"
export * from "./button";
export * from "./card";
TS

# If src/components/ui/button.tsx or card.tsx are missing, add minimal components
[ -f "src/components/ui/button.tsx" ] || cat > src/components/ui/button.tsx << "TSX"
export function Button({ className, ...props }:{ className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={\`inline-flex items-center justify-center rounded-md px-3 py-2 border border-white/10 hover:border-white/20 transition \${className ?? ""}\`} />;
}
TSX
[ -f "src/components/ui/card.tsx" ] || cat > src/components/ui/card.tsx << "TSX"
export function Card(props: React.HTMLAttributes<HTMLDivElement>){ return <div {...props} className={\`rounded-xl border border-white/10 \${props.className ?? ""}\`} /> }
export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>){ return <div {...props} className={\`p-4 border-b border-white/10 \${props.className ?? ""}\`} /> }
export function CardContent(props: React.HTMLAttributes<HTMLDivElement>){ return <div {...props} className={\`p-4 \${props.className ?? ""}\`} /> }
export function CardFooter(props: React.HTMLAttributes<HTMLDivElement>){ return <div {...props} className={\`p-4 border-t border-white/10 \${props.className ?? ""}\`} /> }
TSX

# 7) Toast plumbing (root and src)
log "Adding toast plumbing"
cat > src/components/ui/toast.tsx << "TSX"
export type Toast = { id: string; title?: string; description?: string };
export function ToastViewport(){ return null }
export function ToastProvider({ children }:{ children: React.ReactNode }){ return <>{children}</>; }
export function ToastAction({ altText, children }:{ altText: string; children: React.ReactNode }){ return <>{children}</>; }
export function Toaster(){ return null }
TSX
cat > src/hooks/use-toast.ts << "TS"
import { useState } from "react";
export function useToast(){
  const [toasts, setToasts] = useState<any[]>([]);
  function toast(t:any){ setToasts(s=>[...s, { id: String(Date.now()), ...t }]); }
  return { toast, toasts };
}
TS
cat > src/components/ui/toaster.tsx << "TSX"
import { useToast } from "@/hooks/use-toast";
export default function Toaster(){ const { toasts } = useToast(); return <div>{toasts.length ? null : null}</div>; }
TSX
cp src/components/ui/toast.tsx components/ui/toast.tsx
cp src/components/ui/toaster.tsx components/ui/toaster.tsx
cp src/hooks/use-toast.ts hooks/use-toast.ts

# 8) Install missing peer deps (quiet)
log "Ensuring deps present"
if command -v pnpm >/dev/null 2>&1; then
  pnpm add @supabase/ssr >/dev/null 2>&1 || true
fi

# 9) Typecheck & build
log "Typecheck"
pnpm -s typecheck || die "Type errors remain. See above for the first errors."
log "Build"
pnpm -s build || die "Build failed. See above."

# 10) Commit
log "Commit changes"
git add -A
git commit -m "fix: finalize Verity build (stubs, shadcn exports, supabase shim)" >/dev/null 2>&1 || true

echo "
✅ Verity compiles. You are on branch: $branch

Next:
  • Swap the Supabase cookie shim for real cookies() when wiring auth.
  • Replace UI stubs (AuthClient, CheckoutButton, Stat, etc.) with real implementations.
  • vercel link  &&  vercel  (or vercel --prod) after envs are synced.
"
