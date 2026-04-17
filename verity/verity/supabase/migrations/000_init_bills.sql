create extension if not exists pgcrypto;

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

create or replace view public.bills_mv as
  select id, title, chamber, stage, source_url from public.bills;

create or replace view public.bill_sections_v1 as
  select id, bill_id, ord, heading, text from public.bill_sections;

grant usage on schema public to anon;
grant select on public.bills_mv, public.bill_sections_v1 to anon;
