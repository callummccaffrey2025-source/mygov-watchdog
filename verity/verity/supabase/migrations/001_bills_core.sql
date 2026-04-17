-- 001_bills_core.sql

-- 0) Extensions
create extension if not exists pgcrypto;

-- 1) Tables
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  chamber text,
  stage text,
  source_url text
);

create table if not exists public.bill_sections (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  ord int,
  heading text,
  text text
);

-- 2) Full-text search column + index
alter table public.bill_sections
  add column if not exists tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(heading,'')), 'A')
    || setweight(to_tsvector('english', coalesce(text,'')), 'B')
  ) stored;

create index if not exists bill_sections_tsv_gin
  on public.bill_sections using gin (tsv);

-- 3) Views
create or replace view public.bills_mv as
select
  b.id,
  b.title,
  b.chamber,
  b.stage,
  b.source_url,
  count(s.id)::int as sections_count
from public.bills b
left join public.bill_sections s on s.bill_id = b.id
group by b.id;

create or replace view public.bill_sections_v1 as
select id, bill_id, ord, heading, text
from public.bill_sections;

-- 4) RLS (base tables)
alter table public.bills enable row level security;
alter table public.bill_sections enable row level security;

drop policy if exists "anon can read bills" on public.bills;
create policy "anon can read bills"
  on public.bills for select
  using (true);

drop policy if exists "anon can read bill_sections" on public.bill_sections;
create policy "anon can read bill_sections"
  on public.bill_sections for select
  using (true);

-- 5) Grants (views are invoker by default; grant anyway)
grant select on public.bills, public.bill_sections to anon, authenticated;
grant select on public.bills_mv, public.bill_sections_v1 to anon, authenticated;
