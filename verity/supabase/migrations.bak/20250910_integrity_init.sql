mkdir -p supabase/migrations
cat > supabase/migrations/20250910_integrity_init.sql <<'SQL'
-- ENUMS
create type public.fact_status as enum ('ALLEGATION','INQUIRY','FINDING','CONVICTION','CIVIL_JUDGMENT','PROGRAM_RISK');

-- ENTITIES
create table if not exists public.entity (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('PERSON','ORG','GOV_AGENCY','ELECTORATE')),
  name text not null,
  abn text,
  acn text,
  jurisdiction text,
  created_at timestamptz default now()
);
create index if not exists entity_name_idx on public.entity(name);

create table if not exists public.alias (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entity(id) on delete cascade,
  value text not null
);
create index if not exists alias_entity_idx on public.alias(entity_id);
create index if not exists alias_tsv_idx on public.alias using gin (to_tsvector('simple', value));

-- SOURCE DOCS
create table if not exists public.source_doc (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text,
  publisher text,
  published_at timestamptz,
  sha256 text,
  created_at timestamptz default now()
);
create index if not exists source_publisher_idx on public.source_doc(publisher);
create index if not exists source_published_idx on public.source_doc(published_at);

-- FACTS
create table if not exists public.fact (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('CONTRACT','GRANT','DONATION','WATCHDOG_ACTION','COURT_OUTCOME','FOI_RELEASE','PROGRAM_ALERT')),
  status public.fact_status not null,
  occurred_at timestamptz,
  source_doc_id uuid references public.source_doc(id),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists fact_kind_idx on public.fact(kind);
create index if not exists fact_status_idx on public.fact(status);
create index if not exists fact_occurred_idx on public.fact(occurred_at);

-- LINKS
create table if not exists public.link_entity_fact (
  entity_id uuid not null references public.entity(id) on delete cascade,
  fact_id uuid not null references public.fact(id) on delete cascade,
  role text,
  primary key (entity_id, fact_id)
);

-- COMPLAINTS (private by default)
create table if not exists public.complaint (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  jurisdiction text,
  title text not null,
  description text not null,
  evidence_urls text[] default '{}',
  target_entity_id uuid references public.entity(id),
  created_at timestamptz default now(),
  published boolean default false,
  triage jsonb default '{}'::jsonb
);

-- RLS
alter table public.complaint enable row level security;
create policy "complaint_owner_can_read" on public.complaint
  for select using (auth.uid() = user_id or published is true);
create policy "complaint_owner_can_insert" on public.complaint
  for insert with check (auth.uid() = user_id);
create policy "complaint_owner_can_update" on public.complaint
  for update using (auth.uid() = user_id and published is false);

alter table public.entity enable row level security;
alter table public.alias enable row level security;
alter table public.source_doc enable row level security;
alter table public.fact enable row level security;
alter table public.link_entity_fact enable row level security;

create policy "public_read_entities" on public.entity for select using (true);
create policy "public_read_alias" on public.alias for select using (true);
create policy "public_read_source_doc" on public.source_doc for select using (true);
create policy "public_read_fact" on public.fact for select using (true);
create policy "public_read_links" on public.link_entity_fact for select using (true);

-- STORAGE (buckets)
insert into storage.buckets (id, name, public) values
  ('source_docs','source_docs', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values
  ('evidence','evidence', false)
on conflict (id) do nothing;

-- STORAGE POLICIES
create policy "public read source docs" on storage.objects
  for select to public
  using (bucket_id = 'source_docs');

create policy "owners manage evidence" on storage.objects
  for all to authenticated
  using (bucket_id = 'evidence' and (owner = auth.uid()))
  with check (bucket_id = 'evidence' and (owner = auth.uid()));

-- BASIC VIEWS / RPCs FOR DASHBOARDS

-- Findings in last 30 days
create or replace view public.v_findings_last_30d as
  select f.id, f.kind, f.status, f.occurred_at, sd.title, sd.publisher, sd.url
  from public.fact f
  left join public.source_doc sd on sd.id = f.source_doc_id
  where f.status = 'FINDING' and f.occurred_at >= now() - interval '30 days';

-- Convictions YTD
create or replace view public.v_convictions_ytd as
  select f.id, f.kind, f.status, f.occurred_at, sd.title, sd.publisher, sd.url
  from public.fact f
  left join public.source_doc sd on sd.id = f.source_doc_id
  where f.status = 'CONVICTION'
    and date_part('year', f.occurred_at) = date_part('year', now());

-- Top suppliers by contract count (last 12m)
create or replace view public.v_top_suppliers_12m as
  select e.id as entity_id, e.name, count(*) as contracts
  from public.fact f
  join public.link_entity_fact lef on lef.fact_id = f.id and lef.role = 'supplier'
  join public.entity e on e.id = lef.entity_id
  where f.kind = 'CONTRACT' and f.occurred_at >= now() - interval '12 months'
  group by 1,2
  order by contracts desc
  limit 20;

-- Donation -> award overlaps (count only; no insinuation)
create or replace function public.rpc_donation_award_overlaps_count(days_window int default 365)
returns int language sql stable as $$
  with d as (
    select lef.entity_id, f.occurred_at as donated_at
    from fact f
    join link_entity_fact lef on lef.fact_id = f.id and f.kind = 'DONATION'
  ),
  c as (
    select lef.entity_id, f.occurred_at as awarded_at
    from fact f
    join link_entity_fact lef on lef.fact_id = f.id and f.kind = 'CONTRACT' and lef.role = 'supplier'
  )
  select count(*) from d
  join c on c.entity_id = d.entity_id
  where c.awarded_at between d.donated_at and d.donated_at + (days_window || ' days')::interval;
$$;

SQL

