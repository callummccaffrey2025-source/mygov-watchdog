-- Performance helpers
create extension if not exists pg_trgm;

-- Bills search/filter indexes (safe if they already exist)
create index if not exists idx_bills_stage on public.bills (stage);
create index if not exists idx_bills_updated_at on public.bills (updated_at desc);
create index if not exists idx_bills_title_trgm on public.bills using gin (title gin_trgm_ops);

-- Enable RLS + owner-only policies for follows/alerts if those tables exist.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='follows') then
    alter table public.follows enable row level security;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='follows' and policyname='follows_select_own') then
      create policy follows_select_own on public.follows for select
        using (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='follows' and policyname='follows_ins_own') then
      create policy follows_ins_own on public.follows for insert
        with check (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='follows' and policyname='follows_upd_own') then
      create policy follows_upd_own on public.follows for update
        using (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='follows' and policyname='follows_del_own') then
      create policy follows_del_own on public.follows for delete
        using (auth.uid() = user_id);
    end if;
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='alerts') then
    alter table public.alerts enable row level security;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='alerts' and policyname='alerts_select_own') then
      create policy alerts_select_own on public.alerts for select
        using (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='alerts' and policyname='alerts_ins_own') then
      create policy alerts_ins_own on public.alerts for insert
        with check (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='alerts' and policyname='alerts_upd_own') then
      create policy alerts_upd_own on public.alerts for update
        using (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='alerts' and policyname='alerts_del_own') then
      create policy alerts_del_own on public.alerts for delete
        using (auth.uid() = user_id);
    end if;
  end if;
end$$;
