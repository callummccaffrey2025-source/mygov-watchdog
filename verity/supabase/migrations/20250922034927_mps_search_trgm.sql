create extension if not exists pg_trgm;

-- materialized search vector (no tsvector needed; trgm on name/party/electorate)
create index if not exists mps_name_trgm_idx
  on public.mps using gin (name gin_trgm_ops);
create index if not exists mps_party_trgm_idx
  on public.mps using gin (party gin_trgm_ops);
create index if not exists mps_electorate_trgm_idx
  on public.mps using gin (electorate gin_trgm_ops);

-- RPC: mps_search(q text, limit int, offset int)
create or replace function public.mps_search(q text, lim int default 30, off int default 0)
returns setof public.mps
language sql stable parallel safe
as $$
  select *
  from public.mps
  where
    q is null
    or q = ''
    or name % q
    or party % q
    or electorate % q
  order by similarity(name, coalesce(q,'')) desc nulls last,
           name asc
  limit greatest(lim, 1)
  offset greatest(off, 0);
$$;

grant execute on function public.mps_search(text,int,int) to anon, authenticated;
