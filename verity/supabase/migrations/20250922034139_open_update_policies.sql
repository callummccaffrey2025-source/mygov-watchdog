-- Allow public UPDATEs so UPSERT (insert ... on conflict do update) works in dev.
-- Keep/adjust these later for tighter RLS.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mps' and policyname='mps_update_public'
  ) then
    create policy mps_update_public on public.mps
      for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='bills' and policyname='bills_update_public'
  ) then
    create policy bills_update_public on public.bills
      for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='news_articles' and policyname='news_update_public'
  ) then
    create policy news_update_public on public.news_articles
      for update using (true) with check (true);
  end if;
end$$;
