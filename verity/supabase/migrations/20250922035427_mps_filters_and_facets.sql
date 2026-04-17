-- Fast filters & fuzzy search (uses pg_trgm already installed)

-- Main RPC: filter + search + paging
create or replace function public.mps_filter(
  q        text default null,
  parties  text[] default null,
  houses   text[] default null,
  states   text[] default null,
  lim      int default 30,
  off      int default 0
)
returns setof public.mps
language sql
stable
parallel safe
as $$
  select *
  from public.mps
  where
    -- fuzzy search on name/party/electorate (optional)
    (q is null or q = '' or name % q or party % q or electorate % q)
    -- param filters (arrays are optional; when null we skip)
    and (parties is null or party = any(parties))
    and (houses  is null or house = any(houses))
    and (states  is null or state = any(states))
  order by
    case when q is null or q = '' then 0 else similarity(name, coalesce(q,'')) end desc,
    name asc
  limit greatest(lim, 1)
  offset greatest(off, 0);
$$;

-- Count RPC for paginated UIs
create or replace function public.mps_filter_count(
  q        text default null,
  parties  text[] default null,
  houses   text[] default null,
  states   text[] default null
)
returns bigint
language sql
stable
parallel safe
as $$
  select count(*)
  from public.mps
  where
    (q is null or q = '' or name % q or party % q or electorate % q)
    and (parties is null or party = any(parties))
    and (houses  is null or house = any(houses))
    and (states  is null or state = any(states));
$$;

grant execute on function public.mps_filter(text,text[],text[],text[],int,int)  to anon, authenticated;
grant execute on function public.mps_filter_count(text,text[],text[],text[])   to anon, authenticated;

-- Facets (for building filter chips with counts)
create or replace view public.mps_facets as
  select 'party'::text as facet, party  as value, count(*)::bigint as cnt
  from public.mps where party is not null group by party
  union all
  select 'house', house, count(*)
  from public.mps where house is not null group by house
  union all
  select 'state', state, count(*)
  from public.mps where state is not null group by state;

-- Helpful B-tree indexes for filters (trgm already in place)
create index if not exists mps_house_idx on public.mps (house);
create index if not exists mps_state_idx on public.mps (state);
