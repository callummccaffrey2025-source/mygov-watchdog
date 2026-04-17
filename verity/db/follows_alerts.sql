-- Safe creators
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  bill_id uuid not null,
  created_at timestamptz default now(),
  unique (user_id, bill_id)
);
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  bill_id uuid not null,
  reason text not null, -- e.g. 'stage_changed'
  payload jsonb,
  created_at timestamptz default now()
);
-- RLS
alter table public.follows enable row level security;
alter table public.alerts enable row level security;
do $$ begin
  create policy follows_owner on public.follows
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy alerts_owner on public.alerts
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Helpful view: trending bills = most follows in last 30 days
create or replace view public.trending_bills as
select b.id, b.title, b.status, count(f.id) as followers_30d
from bills b
left join follows f on f.bill_id = b.id and f.created_at > now() - interval '30 days'
group by 1,2,3
order by followers_30d desc nulls last
limit 8;
