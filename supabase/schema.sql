create extension if not exists "pgcrypto";

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text unique,
  title text not null,
  summary text,
  full_text text,
  url text,
  status text,
  introduced_on date,
  updated_at timestamptz default now()
);

create table if not exists public.chunks (
  id bigserial primary key,
  bill_id uuid references public.bills(id) on delete cascade,
  chunk_index int not null,
  content text not null
);

create table if not exists public.mps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  electorate text,
  party text,
  profile_url text
);

create table if not exists public.votes (
  id bigserial primary key,
  mp_id uuid references public.mps(id) on delete cascade,
  bill_id uuid references public.bills(id) on delete cascade,
  vote text check (vote in ('Aye','No','Abstain','Paired')),
  voted_at timestamptz
);

create table if not exists public.sources (
  id bigserial primary key,
  name text not null,
  kind text check (kind in ('json','rss','html','api')) not null,
  url text not null,
  active boolean default true
);

create table if not exists public.change_log (
  id bigserial primary key,
  bill_id uuid references public.bills(id) on delete cascade,
  changed_at timestamptz default now(),
  change_summary text
);

create or replace view public.bill_search as
select b.id, b.title, b.summary, b.url, b.status, b.introduced_on
from public.bills b;

alter table public.bills enable row level security;
alter table public.chunks enable row level security;
alter table public.mps enable row level security;
alter table public.votes enable row level security;
alter table public.sources enable row level security;
alter table public.change_log enable row level security;

create policy "public read bills" on public.bills for select using (true);
create policy "public read chunks" on public.chunks for select using (true);
create policy "public read mps" on public.mps for select using (true);
create policy "public read votes" on public.votes for select using (true);
create policy "public read sources" on public.sources for select using (true);
create policy "public read change_log" on public.change_log for select using (true);
