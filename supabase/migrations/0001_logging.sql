-- Queries asked by a user (or anonymous if you don't wire auth yet)
create table if not exists public.queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  question text not null,
  answer text,
  created_at timestamptz not null default now()
);

-- Top sources used for a query
create table if not exists public.query_sources (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.queries(id) on delete cascade,
  rank int not null,
  score double precision,
  title text,
  url text,
  snippet text
);

-- RLS (safe defaults: read back only your own; inserts allowed)
alter table public.queries enable row level security;
alter table public.query_sources enable row level security;

create policy "own-queries" on public.queries
  for select using (auth.uid() is null or user_id = auth.uid());

create policy "insert-queries" on public.queries
  for insert with check (true);

create policy "own-sources" on public.query_sources
  for select using (
    exists (
      select 1 from public.queries q
      where q.id = query_id
        and (auth.uid() is null or q.user_id = auth.uid())
    )
  );

create policy "insert-sources" on public.query_sources
  for insert with check (true);
