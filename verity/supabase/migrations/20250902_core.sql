create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

create table if not exists public.user_profile (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique not null,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profile(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscription_user_idx on public.subscription(user_id);

create table if not exists public.politician (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  party text,
  electorate text,
  chamber text,
  photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists politician_name_trgm on public.politician using gin (name gin_trgm_ops);

create table if not exists public.bill (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  summary text,
  stage text,
  introduced_on date,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists bill_title_trgm on public.bill using gin (title gin_trgm_ops);

create table if not exists public.bill_sponsor (
  bill_id uuid not null references public.bill(id) on delete cascade,
  politician_id uuid not null references public.politician(id) on delete cascade,
  role text,
  primary key (bill_id, politician_id)
);

create table if not exists public.stance (
  id uuid primary key default uuid_generate_v4(),
  politician_id uuid not null references public.politician(id) on delete cascade,
  bill_id uuid references public.bill(id) on delete set null,
  topic text,
  position text,
  rationale text,
  created_at timestamptz not null default now()
);
create index if not exists stance_politician_idx on public.stance(politician_id);
create index if not exists stance_bill_idx on public.stance(bill_id);

create table if not exists public.rating (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profile(id) on delete cascade,
  politician_id uuid not null references public.politician(id) on delete cascade,
  trust int2 not null check (trust between 1 and 5),
  transparency int2 not null check (transparency between 1 and 5),
  fiscal int2 not null check (fiscal between 1 and 5),
  social_impact int2 not null check (social_impact between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (user_id, politician_id)
);
create index if not exists rating_politician_idx on public.rating(politician_id);

create table if not exists public.watch_bill (
  user_id uuid not null references public.user_profile(id) on delete cascade,
  bill_id uuid not null references public.bill(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, bill_id)
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trig_subscription_updated on public.subscription;
create trigger trig_subscription_updated
before update on public.subscription
for each row execute function public.set_updated_at();

drop trigger if exists trig_user_profile_updated on public.user_profile;
create trigger trig_user_profile_updated
before update on public.user_profile
for each row execute function public.set_updated_at();

alter table public.user_profile   enable row level security;
alter table public.subscription   enable row level security;
alter table public.politician     enable row level security;
alter table public.bill           enable row level security;
alter table public.bill_sponsor   enable row level security;
alter table public.stance         enable row level security;
alter table public.rating         enable row level security;
alter table public.watch_bill     enable row level security;

create policy if not exists "signed-in can read politicians" on public.politician  for select to authenticated using (true);
create policy if not exists "signed-in can read bills"       on public.bill        for select to authenticated using (true);
create policy if not exists "signed-in can read bill_sponsor"on public.bill_sponsor for select to authenticated using (true);
create policy if not exists "signed-in can read stances"     on public.stance      for select to authenticated using (true);

create policy if not exists "user can read own profile" on public.user_profile
  for select to authenticated using (auth.uid() = auth_user_id);
create policy if not exists "user can update own profile" on public.user_profile
  for update to authenticated using (auth.uid() = auth_user_id);

create policy if not exists "user can read own subscription" on public.subscription
  for select to authenticated using (exists (
    select 1 from public.user_profile up where up.id = subscription.user_id and up.auth_user_id = auth.uid()
  ));

create policy if not exists "read ratings" on public.rating for select to authenticated using (true);
create policy if not exists "insert own rating" on public.rating for insert to authenticated with check (
  exists (select 1 from public.user_profile up where up.id = user_id and up.auth_user_id = auth.uid())
);
create policy if not exists "update own rating" on public.rating for update to authenticated using (
  exists (select 1 from public.user_profile up where up.id = user_id and up.auth_user_id = auth.uid())
);

create policy if not exists "read watch" on public.watch_bill for select to authenticated using (
  exists (select 1 from public.user_profile up where up.id = user_id and up.auth_user_id = auth.uid())
);
create policy if not exists "insert watch" on public.watch_bill for insert to authenticated with check (
  exists (select 1 from public.user_profile up where up.id = user_id and up.auth_user_id = auth.uid())
);
create policy if not exists "delete watch" on public.watch_bill for delete to authenticated using (
  exists (select 1 from public.user_profile up where up.id = user_id and up.auth_user_id = auth.uid())
);

insert into public.politician (slug, name, party, electorate, chamber)
values
('john-smith','John Smith','Liberal','North Shore','house'),
('jane-doe','Jane Doe','Labor','Sydney','house')
on conflict (slug) do nothing;

insert into public.bill (slug, title, summary, stage, introduced_on, url)
values
('privacy-amendment-2025','Privacy Amendment Bill 2025',
 'Updates privacy safeguards for digital platforms, penalties, and user rights.',
 'introduced','2025-08-01','https://www.aph.gov.au/')
on conflict (slug) do nothing;
