-- Derive a normalized state code when possible.
-- Rules:
--  - senate: electorate already is the state (NSW, VIC, etc).
--  - reps: leave NULL for now (we'll add a mapping table later).

create or replace function public._infer_state(_house text, _electorate text)
returns text
language sql immutable strict parallel safe
as $$
  with t(code) as (
    select upper(trim(_electorate))
  )
  select case
    when coalesce(_house,'') = 'senate'
         and (select code from t) in ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
      then (select code from t)
    else null
  end
$$;

-- Trigger to populate state on insert/update if missing
create or replace function public.mps_set_state_trg()
returns trigger
language plpgsql
as $$
begin
  if (new.state is null or new.state = '') then
    new.state := public._infer_state(new.house, new.electorate);
  end if;
  return new;
end;
$$;

drop trigger if exists mps_set_state on public.mps;
create trigger mps_set_state
before insert or update of house, electorate, state
on public.mps
for each row execute function public.mps_set_state_trg();

-- Backfill existing rows
update public.mps
set state = public._infer_state(house, electorate)
where (state is null or state = '')
  and house is not null
  and electorate is not null;

-- Make sure the states facet RPC exists (idempotent)
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

grant execute on function public.mps_states() to anon, authenticated;
