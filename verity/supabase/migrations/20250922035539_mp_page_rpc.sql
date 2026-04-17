-- 1) Ensure slug exists + is unique (idempotent)
alter table public.mps
  add column if not exists slug text;

update public.mps
set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
where (slug is null or slug = '')
  and name is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mps_slug_unique'
  ) then
    alter table public.mps add constraint mps_slug_unique unique (slug);
  end if;
end$$;

create index if not exists mps_slug_idx on public.mps (slug);

-- 2) Helper: last token of a name (often the surname)
create or replace function public._last_token(txt text)
returns text language sql immutable parallel safe as $$
  select nullif(regexp_replace(coalesce(txt,''), '.*\s+([^\s]+)$', '\1'), '')
$$;

-- 3) Related bills for an MP by slug (trigram fuzzy on name/surname)
create or replace function public.mp_related_bills(p_slug text, p_limit int default 8)
returns setof public.bills
language sql stable parallel safe
as $$
  with mp as (
    select * from public.mps where slug = p_slug limit 1
  )
  select b.*
  from mp
  join public.bills b
    on (b.title % mp.name)
       or (b.title ilike '%' || public._last_token(mp.name) || '%')
  order by
    greatest(similarity(b.title, mp.name), similarity(b.title, public._last_token(mp.name))) desc nulls last,
    b.title asc
  limit greatest(p_limit,1)
$$;

-- 4) Related news for an MP by slug (fuzzy on title)
create or replace function public.mp_related_news(p_slug text, p_limit int default 10)
returns setof public.news_articles
language sql stable parallel safe
as $$
  with mp as (
    select * from public.mps where slug = p_slug limit 1
  )
  select n.*
  from mp
  join public.news_articles n
    on (n.title % mp.name)
       or (n.title ilike '%' || public._last_token(mp.name) || '%')
  order by
    greatest(similarity(n.title, mp.name), similarity(n.title, public._last_token(mp.name))) desc nulls last,
    n.id desc
  limit greatest(p_limit,1)
$$;

-- 5) Single MP fetch by slug (handy for server components)
create or replace function public.mp_by_slug(p_slug text)
returns public.mps
language sql stable parallel safe
as $$
  select * from public.mps where slug = p_slug limit 1
$$;

-- 6) One-shot JSON payload for /mps/[slug]
create or replace function public.mp_page(p_slug text)
returns jsonb
language sql stable parallel safe
as $$
  with the_mp as (
    select * from public.mps where slug = p_slug limit 1
  )
  select jsonb_build_object(
    'mp',    to_jsonb(m),
    'bills', coalesce(
               (select jsonb_agg(to_jsonb(b)) from public.mp_related_bills(p_slug, 8) b),
               '[]'::jsonb
             ),
    'news',  coalesce(
               (select jsonb_agg(to_jsonb(n)) from public.mp_related_news(p_slug, 10) n),
               '[]'::jsonb
             )
  )
  from the_mp m;
$$;

grant execute on function public.mp_by_slug(text)       to anon, authenticated;
grant execute on function public.mp_related_bills(text,int) to anon, authenticated;
grant execute on function public.mp_related_news(text,int)  to anon, authenticated;
grant execute on function public.mp_page(text)              to anon, authenticated;
