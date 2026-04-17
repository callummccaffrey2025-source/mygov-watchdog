-- De-dupe by title (bills) / url (news_articles), keep earliest row
delete from public.bills a
using public.bills b
where a.ctid > b.ctid and a.title = b.title;

delete from public.news_articles a
using public.news_articles b
where a.ctid > b.ctid and a.url = b.url;

-- Unique constraints to support UPSERT on these keys
do $$
begin
  if not exists (select 1 from pg_constraint where conname='bills_title_unique') then
    alter table public.bills add constraint bills_title_unique unique (title);
  end if;

  if not exists (select 1 from pg_constraint where conname='news_articles_url_unique') then
    alter table public.news_articles add constraint news_articles_url_unique unique (url);
  end if;
end$$;
