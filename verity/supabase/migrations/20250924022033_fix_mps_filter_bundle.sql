create or replace function public.mps_filter_bundle(
  q       text default null,
  parties text[] default null,
  houses  text[] default null,
  states  text[] default null,
  lim     int   default 30,
  off     int   default 0
)
returns table(items jsonb, total int)
language sql stable parallel safe
as $$
  with filtered as (
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
  ),
  counted as (
    select count(*)::int as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by
      case when coalesce(q,'') <> '' then similarity(lower(name), lower(q)) else 0 end desc,
      name asc
    limit greatest(lim,1)
    offset greatest(off,0)
  )
  select
    coalesce((select jsonb_agg(to_jsonb(p.*)) from paged p), '[]'::jsonb) as items,
    (select total from counted) as total;
$$;

grant execute on function public.mps_filter_bundle(text,text[],text[],text[],int,int)
  to anon, authenticated;
