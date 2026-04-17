-- 1) Electorate -> state lookup
create table if not exists public.electorates (
  name  text primary key,
  state text not null check (state in ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA'))
);

-- 2) Backfill MPs' state from lookup (Representatives only)
update public.mps m
set state = e.state
from public.electorates e
where m.house = 'representatives'
  and (m.state is null or m.state = '')
  and e.name = m.electorate;

-- 3) Keep it up to date on future inserts/updates too
create or replace function public.mps_set_state_trg()
returns trigger
language plpgsql
as $$
begin
  if (new.state is null or new.state = '') then
    if new.house = 'senate' then
      new.state := public._infer_state(new.house, new.electorate);
    elsif new.house = 'representatives' then
      select e.state into new.state
      from public.electorates e
      where e.name = new.electorate;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mps_set_state on public.mps;
create trigger mps_set_state
before insert or update of house, electorate, state
on public.mps
for each row execute function public.mps_set_state_trg();
