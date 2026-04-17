alter table public.bills
  add column if not exists updated_at timestamptz default now();

create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists bills_touch_updated on public.bills;
create trigger bills_touch_updated
before update on public.bills
for each row execute function public.tg_touch_updated_at();
