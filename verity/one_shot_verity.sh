#!/usr/bin/env bash
set -euo pipefail

echo "▶ Preconditions check..."
command -v vercel >/dev/null || { echo "Install Vercel CLI: npm i -g vercel"; exit 1; }
command -v supabase >/dev/null || { echo "Install Supabase CLI: npm i -g supabase"; exit 1; }
command -v jq >/dev/null || { echo "Install jq"; exit 1; }
[ -f .env.local ] || { echo ".env.local not found in repo root"; exit 1; }

# -------- 1) Mirror .env.local to Vercel (dev/preview/prod) ----------
echo "▶ Mirroring .env.local → Vercel envs (development/preview/production)..."
# Parse .env.local into key=value lines (ignore comments/blank lines)
mapfile -t ENV_LINES < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env.local | sed 's/[[:space:]]*$//')

# function to upsert one key/value to all envs in vercel
upsert_vercel () {
  local k="$1" v="$2"
  for env in development preview production; do
    # remove existing key (ignore errors if not present), then add
    vercel env rm "$k" "$env" -y >/dev/null 2>&1 || true
    printf "%s" "$v" | vercel env add "$k" "$env" >/dev/null
  done
}
# loop keys
for line in "${ENV_LINES[@]}"; do
  k="${line%%=*}"
  v="${line#*=}"
  # guard against exporting dangerous multiline vals
  if [[ -n "$k" && -n "$v" ]]; then
    upsert_vercel "$k" "$v"
  fi
done
echo "✅ Vercel envs updated."

# -------- 2) Deploy Supabase Edge Function: crawler ----------
echo "▶ Ensuring supabase/functions/crawler exists..."
mkdir -p supabase/functions/crawler

cat > supabase/functions/crawler/index.ts <<'TS'
/**
 * Minimal crawler edge function:
 * - claims one crawl_job
 * - fetches URL if host allowed
 * - inserts/updates document
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED = (Deno.env.get("VERITY_ALLOWED_HOSTS") || "")
  .split(",").map(s => s.trim()).filter(Boolean);

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function hostAllowed(u: string) {
  try {
    const h = new URL(u).host.toLowerCase();
    return ALLOWED.some(a => h.endsWith(a.toLowerCase()));
  } catch { return false; }
}

serve(async () => {
  // 1) claim a job
  const { data: job, error: claimErr } = await supa.rpc("claim_crawl_job");
  if (claimErr || !job) return new Response(JSON.stringify({ ok: true, claimed: 0 }), { headers: { "content-type": "application/json" }});

  const { id, url, source_id } = job;
  if (!hostAllowed(url)) {
    await supa.from("crawl_job").update({ status: "error", error: "host not allowed" }).eq("id", id);
    return Response.json({ ok: false, reason: "host not allowed", url });
  }

  // 2) fetch page
  const res = await fetch(url, { redirect: "follow" });
  const html = await res.text();

  // naive title extraction
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const title = m?.[1]?.trim() || url;

  // 3) upsert document
  const doc = {
    source_id,
    jurisdiction: "AU",
    title,
    url,
    content: html.replace(/\s+/g, " ").slice(0, 500000), // cap
    published_at: new Date().toISOString(),
  };

  const { error: insErr } = await supa
    .from("document")
    .upsert(doc, { onConflict: "url" });

  await supa.from("crawl_job").update({
    status: insErr ? "error" : "done",
    error: insErr?.message || null
  }).eq("id", id);

  return Response.json({ ok: !insErr, job_id: id, title, url });
});
TS

# Function config (Deno deploy target)
cat > supabase/functions/crawler/deno.json <<'JSON'
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.46.1"
  }
}
JSON

echo "▶ Linking env to function..."
# Expose needed env to the function (reads from your .env.local values)
while IFS='=' read -r K V; do
  case "$K" in
    SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|VERITY_ALLOWED_HOSTS)
      supabase functions secrets set "$K=$V" >/dev/null
      ;;
  esac
done < <(grep -E '^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|VERITY_ALLOWED_HOSTS)=' .env.local)

echo "▶ Deploying Supabase Edge Function: crawler..."
supabase functions deploy crawler >/dev/null
echo "✅ Crawler deployed."

# -------- 3) Seed sources into production DB ----------
echo "▶ Seeding official AU sources (uses your seed_sources.sh if present)..."
if [ -f ./seed_sources.sh ]; then
  # shellcheck disable=SC1091
  set +u
  source ./.env.local
  set -u
  export SUPABASE_URL
  export SUPABASE_SERVICE_ROLE_KEY
  bash ./seed_sources.sh
else
  echo "seed_sources.sh not found; writing a minimal seeder and running it..."
  cat > seed_sources.min.sh <<'BASH'
#!/usr/bin/env bash
set -euo pipefail
: "${SUPABASE_URL:?SUPABASE_URL must be set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY must be set}"

rows=$'Hansard|https://www.aph.gov.au/Parliamentary_Business/Hansard|AU|parliament\nPM – Media|https://www.pm.gov.au/media|AU|agency\nAttorney-General – Media|https://www.attorneygeneral.gov.au/media|AU|agency\nHealth – News|https://www.health.gov.au/news|AU|agency'
while IFS='|' read -r name url jurisdiction p_type; do
  curl -sS -X POST "$SUPABASE_URL/rest/v1/rpc/create_crawl_job" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg n "$name" --arg u "$url" --arg j "$jurisdiction" --arg t "$p_type" \
         '{name:$n, url:$u, jurisdiction:$j, p_type:$t}')" | jq -r '.'
done
BASH
  chmod +x seed_sources.min.sh
  # shellcheck disable=SC1091
  set +u
  source ./.env.local
  set -u
  export SUPABASE_URL
  export SUPABASE_SERVICE_ROLE_KEY
  ./seed_sources.min.sh
fi
echo "✅ Sources seeded."

# -------- 4) Kick the flow: crawl → index → search smoke test ----------
echo "▶ Invoking crawler function a few times to process the queue..."
for i in {1..5}; do
  supabase functions invoke crawler >/dev/null || true
done
echo "▶ Rebuilding Pinecone index from DB (calls your /api/cron/reindex if present)..."
if curl -fsS "${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}/api/cron/reindex" >/dev/null 2>&1; then
  echo "✅ Reindex endpoint hit."
else
  echo "ℹ️ Could not reach /api/cron/reindex (non-fatal)."
fi

echo "▶ Smoke test search..."
QUERY="budget"
SEARCH_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}/api/search?q=$(printf '%s' "$QUERY" | jq -sRr @uri)"
if curl -fsS "$SEARCH_URL" | head -c 400; then
  echo -e "\n✅ Search responded."
else
  echo "⚠️ Search endpoint not reachable; check deployment."
fi

echo "🎉 All done."

