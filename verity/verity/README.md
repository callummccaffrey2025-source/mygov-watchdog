# Verity

## Local setup

1. Copy `.env.example` to `.env.local` and fill:
   - NEXT_PUBLIC_SUPABASE_URL=...
   - NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   - NEXT_PUBLIC_SITE_URL=http://localhost:3000

2. Run migrations into your Supabase project:
   supabase link --project-ref <your-project-ref>
   supabase db push --include-all

3. Start dev:
   pnpm install
   pnpm dev

4. Smoke check:
   pnpm doctor    # runs agents/doctor.sh
   pnpm sitemap   # writes public/sitemap.xml

## Routes

- Roadmap: `/roadmap`
- Legislation list: `/legislation`
- Individual bill: `/legislation/:id`
