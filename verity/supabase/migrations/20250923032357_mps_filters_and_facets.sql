-- ===== Indexes for fast filtering/search =====
create index if not exists mps_party_lower_idx      on public.mps (lower(party));
create index if not exists mps_house_lower_idx      on public.mps (lower(house));
create index if not exists mps_state_lower_idx      on public.mps (lower(state));
create index if not exists mps_slug_unique_idx      on public.mps (slug);

-- ===== Filter RPC: text query + array filters + paging =====
create or replace function public.mps_filter(
  q     text default null,
  parties text[] default null,
  houses  text[] default null,
  states  text[] default null,
  lim   int default 30,
  off   int default 0
)
returns setof public.mps
language sql stable parallel safe
as $$
  with base as (
    select *
    from public.mps
    where
      -- text search (trigram) optional
      (q is null or q = '' or name % q or party % q or electorate % q)
      -- filters (case-insensitive)
      and (parties is null or array_length(parties,1) is null or lower(party)  = any (select lower(p) from unnest(parties) p))
      and (houses  is null or array_length(houses,1)  is null or lower(house)  = any (select lower(h) from unnest(houses) h))
      and (states  is null or array_length(states,1)  is null or lower(state)  = any (select lower(s) from unnest(states) s))
  )
  select *
  from base
  order by similarity(name, coalesce(q,'')) desc nulls last, name asc
  limit greatest(lim,1)
  offset greatest(off,0);
$$;

grant execute on function public.mps_filter(text,text[],text[],text[],int,int) to anon, authenticated;

-- ===== Total count RPC (for pagination UI) =====
create or replace function public.mps_filter_total(
  q     text default null,
  parties text[] default null,
  houses  text[] default null,
  states  text[] default null
)
returns int
language sql stable parallel safe
as $$
  select count(*)
  from public.mps
  where
    (q is null or q = '' or name % q or party % q or electorate % q)
    and (parties is null or array_length(parties,1) is null or lower(party)  = any (select lower(p) from unnest(parties) p))
    and (houses  is null or array_length(houses,1)  is null or lower(house)  = any (select lower(h) from unnest(houses) h))
    and (states  is null or array_length(states,1)  is null or lower(state)  = any (select lower(s) from unnest(states) s));
$$;

grant execute on function public.mps_filter_total(text,text[],text[],text[]) to anon, authenticated;

-- ===== Facet RPCs with counts =====
create or replace function public.mps_parties()
returns table (party text, n bigint)
language sql stable parallel safe
as $$ select party, count(*)::bigint as n
      from public.mps
      where party is not null and party <> ''
      group by party
      order by n desc, party; $$;

create or replace function public.mps_houses()
returns table (house text, n bigint)
language sql stable parallel safe
as $$ select house, count(*)::bigint as n
      from public.mps
      where house is not null and house <> ''
      group by house
      order by n desc, house; $$;

create or replace function public.mps_states()
returns table (state text, n bigint)
language sql stable parallel safe
as $$ select state, count(*)::bigint as n
      from public.mps
      where state is not null and state <> ''
      group by state
      order by n desc, state; $$;

grant execute on function public.mps_parties() to anon, authenticated;
grant execute on function public.mps_houses()  to anon, authenticated;
grant execute on function public.mps_states()  to anon, authenticated;

-- Ensure slugs exist (idempotent)
update public.mps
set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
where (slug is null or slug = '') and name is not null;
