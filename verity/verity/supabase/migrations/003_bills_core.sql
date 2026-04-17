-- extensions + compat shim
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
do $$ begin
  if not exists (select 1 from pg_proc where proname='uuid_generate_v4') then
    create or replace function uuid_generate_v4() returns uuid
    language sql stable as $$ select gen_random_uuid() $$;
  end if;
end $$;

-- tables
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  title text,
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

-- FTS column + index
alter table public.bill_sections
  add column if not exists tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(heading,'')),'A')
    || setweight(to_tsvector('english', coalesce(text,'')),'B')
  ) stored;
create index if not exists bill_sections_tsv_idx on public.bill_sections using gin(tsv);

-- views
create or replace view public.bills_mv as
  select id, title, chamber, stage, source_url from public.bills;

create or replace view public.bill_sections_v1 as
  select id, bill_id, ord, heading, text from public.bill_sections;

-- RPC search
create or replace function public.search_bill_sections(q text, lim int default 5)
returns table(id uuid, bill_id uuid, ord int, heading text, text text, rank real)
language sql stable as $$
  select s.id, s.bill_id, s.ord, s.heading, s.text,
         ts_rank(s.tsv, plainto_tsquery('english', q)) as rank
  from public.bill_sections s
  where s.tsv @@ plainto_tsquery('english', q)
  order by rank desc
  limit lim;
$$;

-- RLS + grants
alter table public.bills enable row level security;
alter table public.bill_sections enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='bills' and policyname='anon_select_bills') then
    create policy anon_select_bills on public.bills for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='bill_sections' and policyname='anon_select_bill_sections') then
    create policy anon_select_bill_sections on public.bill_sections for select to anon using (true);
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select on public.bills, public.bill_sections to anon, authenticated;
grant select on public.bills_mv, public.bill_sections_v1 to anon, authenticated;
grant execute on function public.search_bill_sections(text, int) to anon, authenticated;
