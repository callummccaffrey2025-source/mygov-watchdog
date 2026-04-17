-- IDs & metadata
alter table public.mps
  add column if not exists tvfy_person_id int,
  add column if not exists house text,
  add column if not exists state text,
  add column if not exists slug text,
  add column if not exists photo_url text,
  add column if not exists last_seen timestamptz default now();

-- sensible uniqueness; TVFY id wins when present
do $$
begin
  if not exists (select 1 from pg_constraint where conname='mps_tvfy_person_id_unique') then
    alter table public.mps add constraint mps_tvfy_person_id_unique unique (tvfy_person_id);
  end if;
exception when duplicate_table then null;
end$$;

-- fallback uniqueness (you already have this)
-- ensure fast lookups/sorts
create index if not exists mps_name_idx on public.mps (name);
create index if not exists mps_party_idx on public.mps (party);
create index if not exists mps_electorate_idx on public.mps (electorate);
create index if not exists mps_slug_idx on public.mps (slug);

-- simple slugger (idempotent)
update public.mps
set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
where (slug is null or slug = '')
  and name is not null;

