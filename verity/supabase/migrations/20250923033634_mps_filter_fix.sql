-- Fast indexes for case-insensitive trigram search
create extension if not exists pg_trgm;

create index if not exists mps_name_trgm_lower_idx
  on public.mps using gin (lower(name) gin_trgm_ops);
create index if not exists mps_party_trgm_lower_idx
  on public.mps using gin (lower(party) gin_trgm_ops);
create index if not exists mps_electorate_trgm_lower_idx
  on public.mps using gin (lower(electorate) gin_trgm_ops);

-- Helper predicate reused in both RPCs
-- Match if q empty OR ILIKE OR trigram similar on any of the 3 fields
create or replace function public._mps_q_match(_name text, _party text, _electorate text, q text)
returns boolean
language sql immutable parallel safe
as $$
  select
    coalesce(q,'') = '' OR
    lower(_name)      like '%'||lower(q)||'%' OR
    lower(_party)     like '%'||lower(q)||'%' OR
    lower(_electorate) like '%'||lower(q)||'%' OR
    (_name % q) OR (_party % q) OR (_electorate % q);
$$;

-- Filtered rows with paging
create or replace function public.mps_filter(
  q       text default null,
  parties text[] default null,
  houses  text[] default null,
  states  text[] default null,
  lim     int   default 30,
  off     int   default 0
)
returns setof public.mps
language sql stable parallel safe
as $$
  select *
  from public.mps
  where
    public._mps_q_match(name, party, electorate, q)
    and (parties is null or array_length(parties,1) is null
         or lower(party) = any (select lower(p) from unnest(parties) p))
    and (houses is null or array_length(houses,1) is null
         or lower(house) = any (select lower(h) from unnest(houses) h))
    and (states is null or array_length(states,1) is null
         or lower(state) = any (select lower(s) from unnest(states) s))
  order by
    -- when q provided, sort by trigram similarity then name
    case when coalesce(q,'') <> '' then similarity(lower(name), lower(q)) else 0 end desc,
    name asc
  limit greatest(lim,1)
  offset greatest(off,0);
$$;

grant execute on function public.mps_filter(text,text[],text[],text[],int,int) to anon, authenticated;

-- Total count for the same filter
create or replace function public.mps_filter_total(
  q       text default null,
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
    public._mps_q_match(name, party, electorate, q)
    and (parties is null or array_length(parties,1) is null
         or lower(party) = any (select lower(p) from unnest(parties) p))
    and (houses is null or array_length(houses,1) is null
         or lower(house) = any (select lower(h) from unnest(houses) h))
    and (states is null or array_length(states,1) is null
         or lower(state) = any (select lower(s) from unnest(states) s));
$$;

grant execute on function public.mps_filter_total(text,text[],text[],text[]) to anon, authenticated;
