#!/usr/bin/env bash
set -e

# Ensure folder is correct & writable
if [ -e supabase ] && [ ! -d supabase ]; then
  echo "⚠ Found a file named 'supabase' — renaming to supabase.bak.$(date +%s)"
  mv supabase "supabase.bak.$(date +%s)"
fi
mkdir -p supabase/migrations
chmod -R u+rwX supabase

MIG="supabase/migrations/20250829_init.sql"

# === Clean, corrected SQL (idempotent) ===
cat > "$MIG" <<'SQL'
-- Verity base schema (idempotent, safe to re-run)

create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

create table if not exists document(
  id bigserial primary key,
  source_id bigint,
  jurisdiction text,
  title text,
  url text,
  content text,
  content_tsv tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored,
  published_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists document_content_idx on document using gin(content_tsv);

create table if not exists user_profile(
  user_id uuid primary key,
  handle text unique,
  created_at timestamptz default now()
);

alter table user_profile enable row level security;

drop policy if exists "own profile select" on user_profile;
create policy "own profile select" on user_profile for select using (auth.uid() = user_id);

drop policy if exists "own profile upsert" on user_profile;
create policy "own profile upsert" on user_profile for insert with check (auth.uid() = user_id);

drop policy if exists "own profile update" on user_profile;
create policy "own profile update" on user_profile for update using (auth.uid() = user_id);

create table if not exists subscription(
  user_id uuid primary key references user_profile(user_id) on delete cascade,
  is_active boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'basic'
);

create table if not exists watch_document(
  id bigserial primary key,
  user_id uuid not null references user_profile(user_id) on delete cascade,
  document_id bigint not null references document(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists alert_rule(
  id bigserial primary key,
  user_id uuid not null references user_profile(user_id) on delete cascade,
  keyword text,
  politician text,
  region text,
  created_at timestamptz default now()
);

-- Minimal source/crawl_job + RPC
create table if not exists source(
  id bigserial primary key,
  name text not null unique,
  url text not null,
  jurisdiction text,
  type text check (type in ('generic','parliament','federal','state','territory','court','gazette','agency','news','ngo','party')),
  created_at timestamptz default now()
);

create table if not exists crawl_job(
  id bigserial primary key,
  source_id bigint not null references source(id) on delete cascade,
  status text not null default 'queued',
  created_at timestamptz default now()
);

create or replace function create_crawl_job(
  p_name text,
  p_url text,
  p_jurisdiction text,
  p_type text
) returns bigint
language plpgsql
as $$
declare
  v_source_id bigint;
  v_job_id bigint;
begin
  insert into source(name, url, jurisdiction, type)
  values (p_name, p_url, p_jurisdiction, p_type)
  on conflict (name) do update
    set url = excluded.url,
        jurisdiction = excluded.jurisdiction,
        type = excluded.type
  returning id into v_source_id;

  insert into crawl_job(source_id, status)
  values (v_source_id, 'queued')
  returning id into v_job_id;

  return v_job_id;
end;
$$;
SQL

# README (safe overwrite)
cat > README.md <<'MD'
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
MD

# Nice footer
printf "✅ Fixed.\n   • Migration written: %s\n   • README.md written\n" "$MIG"
