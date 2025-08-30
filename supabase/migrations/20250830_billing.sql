-- Users & subscriptions (idempotent)

-- Ensure user_profile has a stripe_customer_id
alter table if exists public.user_profile
  add column if not exists stripe_customer_id text;

-- Subscription table (if not exists)
create table if not exists public.subscription (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null check (status in ('trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired')),
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  price_id text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists subscription_user_id_idx on public.subscription (user_id);
create index if not exists subscription_status_idx on public.subscription (status);
create unique index if not exists subscription_sub_id_uniq on public.subscription (stripe_subscription_id);

-- RLS
alter table public.subscription enable row level security;

-- Policies: user can read own subs
drop policy if exists "read own subs" on public.subscription;
create policy "read own subs" on public.subscription
for select
using (auth.uid() = user_id);

-- Block client writes; only service role (API/webhook) writes
drop policy if exists "no client writes" on public.subscription;
create policy "no client writes" on public.subscription
as restrictive for all
to authenticated
using (false)
with check (false);

-- Trigger to maintain updated_at
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists subscription_touch on public.subscription;
create trigger subscription_touch
before update on public.subscription
for each row execute function public.touch_updated_at();
