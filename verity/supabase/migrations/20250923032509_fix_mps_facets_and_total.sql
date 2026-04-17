-- ===== Correct facet RPCs (alias the count as n) =====
create or replace function public.mps_parties()
returns table (party text, n bigint)
language sql stable parallel safe
as $$
  select party, count(*)::bigint as n
  from public.mps
  where party is not null and party <> ''
  group by party
  order by n desc, party
$$;

create or replace function public.mps_houses()
returns table (house text, n bigint)
language sql stable parallel safe
as $$
  select house, count(*)::bigint as n
  from public.mps
  where house is not null and house <> ''
  group by house
  order by n desc, house
$$;

create or replace function public.mps_states()
returns table (state text, n bigint)
language sql stable parallel safe
as $$
  select state, count(*)::bigint as n
  from public.mps
  where state is not null and state <> ''
  group by state
  order by n desc, state
$$;

grant execute on function public.mps_parties() to anon, authenticated;
grant execute on function public.mps_houses()  to anon, authenticated;
grant execute on function public.mps_states()  to anon, authenticated;

-- ===== Missing total-count RPC (matches mps_filter signature) =====
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
    (q is null or q = '' or name % q or party % q or electorate % q)
    and (parties is null or array_length(parties,1) is null
         or lower(party) = any (select lower(p) from unnest(parties) p))
    and (houses  is null or array_length(houses,1)  is null
         or lower(house) = any (select lower(h) from unnest(houses) h))
    and (states  is null or array_length(states,1)  is null
         or lower(state) = any (select lower(s) from unnest(states) s));
$$;

grant execute on function public.mps_filter_total(text,text[],text[],text[]) to anon, authenticated;
