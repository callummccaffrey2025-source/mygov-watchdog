create or replace function public.search_bill_sections(q text, lim int default 20)
returns table(id uuid, bill_id uuid, heading text, snippet text)
language sql stable as $$
  with query_ts as (
    select plainto_tsquery('english', coalesce(q, '')) as tsq
  )
  select
    s.id,
    s.bill_id,
    s.heading,
    ts_headline(
      'english',
      coalesce(s.text, ''),
      query_ts.tsq,
      'MaxFragments=2, MinWords=6, MaxWords=24, StartSel=<mark>, StopSel=</mark>'
    ) as snippet
  from public.bill_sections s
  cross join query_ts
  where s.tsv @@ query_ts.tsq
  order by ts_rank(s.tsv, query_ts.tsq) desc
  limit least(20, greatest(1, coalesce(lim, 20)));
$$;
