-- tsvector index if not present
create index if not exists document_content_tsv_idx on public.document using gin (content_tsv);

-- rpc: verity_search_docs(query text)
create or replace function public.verity_search_docs(query text)
returns table(id uuid, title text, url text, content text, published_at timestamptz, rank real)
language sql stable as $$
  select d.id, d.title, d.url, d.content, d.published_at,
         ts_rank_cd(d.content_tsv, plainto_tsquery('english', query)) as rank
  from public.document d
  where d.content_tsv @@ plainto_tsquery('english', query)
  order by rank desc, coalesce(d.published_at, now()) desc
  limit 50
$$;

