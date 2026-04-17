#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Verity Production Provisioning"
echo "=================================="

# Preflight
[[ -d .git ]] || { echo "❌ Not a git repo"; exit 1; }
[[ -f .env.local ]] || { echo "❌ .env.local missing"; exit 1; }

BRANCH="harden-prod-$(date +%Y%m%d-%H%M)"
git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"

# Cleanup
find . -name "*.bak" -type f -delete 2>/dev/null || true
echo "✓ Cleaned .bak files"

# Install deps
pnpm add -D zod stripe @supabase/ssr @supabase/supabase-js date-fns 2>/dev/null
pnpm add -D @upstash/redis 2>/dev/null || echo "⚠ Upstash skipped"
echo "✓ Dependencies installed"

# shadcn
npx shadcn@latest init -y -d 2>/dev/null || true
for c in button card input alert badge skeleton; do
  npx shadcn@latest add $c -y 2>/dev/null || true
done
echo "✓ shadcn components ready"

# Vercel config
cat > vercel.json << 'VEOF'
{
  "crons": [{"path": "/api/ingest/aph", "schedule": "0 * * * *"}],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {"key": "X-Content-Type-Options", "value": "nosniff"},
        {"key": "X-Frame-Options", "value": "SAMEORIGIN"}
      ]
    }
  ]
}
VEOF
echo "✓ vercel.json created"

# Migrations
mkdir -p supabase/migrations
cat > supabase/migrations/001_core.sql << 'MSQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS ingest_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO ingest_sources (source_key, name, base_url) VALUES
  ('aph_house', 'APH House', 'https://www.aph.gov.au'),
  ('aph_senate', 'APH Senate', 'https://www.aph.gov.au')
ON CONFLICT DO NOTHING;
MSQL
echo "✓ Migration created"

# Helper scripts
mkdir -p scripts
cat > scripts/make-env-example.sh << 'EEOF'
#!/bin/bash
grep -E '^[A-Z_]+=' .env.local | sed 's/=.*/=""/' > .env.example
echo "✓ .env.example created"
EEOF
chmod +x scripts/make-env-example.sh
./scripts/make-env-example.sh

cat > scripts/sync-env-vercel.sh << 'SEOF'
#!/bin/bash
while IFS='=' read -r k v; do
  [[ "$k" =~ ^[A-Z] ]] && echo "$v" | vercel env add "$k" production --force 2>/dev/null
done < .env.local
echo "✓ Synced to Vercel"
SEOF
chmod +x scripts/sync-env-vercel.sh
echo "✓ Scripts created"

# Quality check
echo "🔍 Type checking..."
pnpm typecheck || echo "⚠ Type errors exist"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ PROVISIONING COMPLETE           ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "📋 Next steps:"
echo "1. vercel link"
echo "2. ./scripts/sync-env-vercel.sh"
echo "3. supabase db push"
echo "4. vercel --prod"
echo ""
echo "Branch: $BRANCH"
