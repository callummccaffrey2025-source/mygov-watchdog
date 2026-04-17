-- Idempotent core tables
create table if not exists sources (
  id text primary key,
  url text,
  meta jsonb,
  created_at timestamptz default now()
);

create table if not exists bills (
  id text primary key,               -- stable external id you derive
  title text not null,
  chamber text check (chamber in ('House','Senate')) ,
  status text,
  introduced_at timestamptz,
  last_movement_at timestamptz,
  source_url text,
  search tsvector,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists bills_last_movement_idx on bills (last_movement_at desc);
create index if not exists bills_search_idx on bills using gin (search);

create or replace function bills_tsvector_trigger() returns trigger as $$
begin
  new.search := to_tsvector('english', coalesce(new.title,'') || ' ' || coalesce(new.status,''));
  return new;
end
$$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='bills_tsvector_update') then
    create trigger bills_tsvector_update before insert or update on bills
      for each row execute function bills_tsvector_trigger();
  end if;
end $$;

create table if not exists bill_movements (
  id text primary key,               -- billId + iso timestamp
  bill_id text references bills(id) on delete cascade,
  stage text,
  status text,
  occurred_at timestamptz not null,
  source_url text,
  created_at timestamptz default now()
);
create index if not exists bill_movements_time_idx on bill_movements (occurred_at desc);
create index if not exists bill_movements_bill_idx on bill_movements (bill_id);

create table if not exists divisions (
  id text primary key,               -- stable external id (e.g., link slug or GUID)
  title text,
  chamber text check (chamber in ('House','Senate')),
  occurred_at timestamptz,
  bill_id text references bills(id),
  source_url text,
  created_at timestamptz default now()
);
create index if not exists divisions_time_idx on divisions (occurred_at desc);
create index if not exists divisions_bill_idx on divisions (bill_id);

create table if not exists division_votes (
  id text primary key,               -- divisionId + memberId
  division_id text references divisions(id) on delete cascade,
  member_id text,
  vote text check (vote in ('Aye','No','Abstain','Paired')),
  created_at timestamptz default now()
);

create table if not exists members (
  id text primary key,               -- external stable id
  name text not null,
  chamber text,
  electorate_id text,
  party_id text,
  source_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists parties (
  id text primary key,
  name text unique,
  created_at timestamptz default now()
);

create table if not exists electorates (
  id text primary key,
  name text unique,
  state text,
  created_at timestamptz default now()
);

create table if not exists ingest_cursors (
  name text primary key,
  since timestamptz,
  meta jsonb,
  updated_at timestamptz default now()
);

create table if not exists ingest_events (
  id bigserial primary key,
  name text,
  ok boolean,
  fetched int,
  upserted int,
  skipped int,
  duration_ms int,
  note text,
  created_at timestamptz default now()
);

-- Safe RLS reminder (no destructive change here); implement policies separately as needed.
