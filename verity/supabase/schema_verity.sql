create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create table if not exists parties(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short text not null
);

create table if not exists electorates(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  state text not null
);

create table if not exists mps(
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  slug text not null unique,
  party_id uuid references parties(id),
  electorate_id uuid references electorates(id),
  chamber text not null check (chamber in ('House','Senate')),
  started date,
  photo_url text
);

create table if not exists bills(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  chamber text not null check (chamber in ('House','Senate')),
  introduced date,
  sponsor_mp_id uuid references mps(id)
);

create table if not exists bill_events(
  id bigserial primary key,
  bill_id uuid references bills(id) on delete cascade,
  happened_at timestamptz not null,
  kind text not null,
  details text
);

create table if not exists votes(
  id bigserial primary key,
  bill_id uuid references bills(id) on delete cascade,
  voted_at timestamptz not null,
  division text,
  result text
);

create table if not exists mp_votes(
  vote_id bigint references votes(id) on delete cascade,
  mp_id uuid references mps(id) on delete cascade,
  position text not null check (position in ('Aye','No','Abstain','Absent')),
  primary key (vote_id, mp_id)
);

create table if not exists sources(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  url text not null,
  bias text check (bias in ('Left','Center-Left','Center','Center-Right','Right','Unknown')) default 'Unknown'
);

create table if not exists news_articles(
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id),
  url text not null unique,
  title text not null,
  topic text,
  published_at timestamptz not null,
  summary text,
  bias_score int,
  related_bill_id uuid references bills(id),
  related_mp_id uuid references mps(id)
);

create table if not exists user_preferences(
  user_id uuid primary key references auth.users(id) on delete cascade,
  electorate_id uuid references electorates(id),
  topics text[]
);

create table if not exists alerts(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,   -- 'bill_update','mp_vote','news_brief'
  target_id text,
  created_at timestamptz not null default now()
);

create or replace view v_mp_card as
select m.id, m.slug, m.full_name, p.short as party, e.name as electorate, m.chamber, m.photo_url
from mps m
left join parties p on p.id = m.party_id
left join electorates e on e.id = m.electorate_id;

create or replace view v_bill_card as
select b.id, b.slug, b.title, b.summary, b.chamber, b.introduced,
       m.full_name as sponsor, p.short as sponsor_party
from bills b
left join mps m on m.id = b.sponsor_mp_id
left join parties p on p.id = m.party_id;

alter table parties enable row level security;
alter table electorates enable row level security;
alter table mps enable row level security;
alter table bills enable row level security;
alter table bill_events enable row level security;
alter table votes enable row level security;
alter table mp_votes enable row level security;
alter table sources enable row level security;
alter table news_articles enable row level security;
alter table user_preferences enable row level security;
alter table alerts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='p_read_parties' and tablename='parties') then
    create policy p_read_parties on parties for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_read_electorates' and tablename='electorates') then
    create policy p_read_electorates on electorates for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_read_mps' and tablename='mps') then
    create policy p_read_mps on mps for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_read_bills' and tablename='bills') then
    create policy p_read_bills on bills for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_read_bill_events' and tablename='bill_events') then
    create policy p_read_bill_events on bill_events for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_read_votes' and tablename='votes') then
    create policy p_read_votes on votes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_read_mp_votes' and tablename='mp_votes') then
    create policy p_read_mp_votes on mp_votes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_read_sources' and tablename='sources') then
    create policy p_read_sources on sources for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_read_news' and tablename='news_articles') then
    create policy p_read_news on news_articles for select using (true);
  end if;

  if not exists (select 1 from pg_policies where policyname='p_up_prefs_select' and tablename='user_preferences') then
    create policy p_up_prefs_select on user_preferences for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_up_prefs_upsert' and tablename='user_preferences') then
    create policy p_up_prefs_upsert on user_preferences for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_up_prefs_update' and tablename='user_preferences') then
    create policy p_up_prefs_update on user_preferences for update using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where policyname='p_alerts_select' and tablename='alerts') then
    create policy p_alerts_select on alerts for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_alerts_ins' and tablename='alerts') then
    create policy p_alerts_ins on alerts for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='p_alerts_del' and tablename='alerts') then
    create policy p_alerts_del on alerts for delete using (auth.uid() = user_id);
  end if;
end$$;
