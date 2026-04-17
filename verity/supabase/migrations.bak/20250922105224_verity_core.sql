-- === Verity core schema ===
create extension if not exists "pgcrypto";

-- MPs
create table if not exists public.mps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  party text,
  electorate text
);
alter table public.mps enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mps' and policyname='mps_select_public') then
    create policy mps_select_public on public.mps for select using (true);
  end if;
end $$;

-- Bills
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text,
  updated_at timestamptz not null default now()
);
create index if not exists bills_updated_at_idx on public.bills (updated_at desc);
alter table public.bills enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bills' and policyname='bills_select_public') then
    create policy bills_select_public on public.bills for select using (true);
  end if;
end $$;

-- News
create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text,
  url text,
  published_at timestamptz not null default now()
);
create index if not exists news_published_at_idx on public.news_articles (published_at desc);
alter table public.news_articles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='news_articles' and policyname='news_select_public') then
    create policy news_select_public on public.news_articles for select using (true);
  end if;
end $$;
