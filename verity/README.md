# Verity — Technical Foundation

## What you have
- Next.js app with starter UI (/ask, /search)
- Supabase, Pinecone, OpenAI wired (src/lib/*)
- Schema in `supabase/migrations/20250829_init.sql`
- Seed script you can add later for safe AU sources
- Stripe/Sentry optional via env vars

## Next steps
1) Fill `.env.local`
2) Create Pinecone index `verity` (1536 dim, cosine)
3) Run SQL in Supabase (SQL Editor → paste migration file)
4) `pnpm dev` locally, then deploy to Vercel
5) Seed sources via RPC (script below)
