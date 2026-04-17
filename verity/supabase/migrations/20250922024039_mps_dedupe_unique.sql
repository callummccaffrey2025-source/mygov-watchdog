-- Delete duplicate MPs (same name + electorate), keep the earliest row
delete from public.mps a
using public.mps b
where a.ctid > b.ctid
  and a.name = b.name
  and coalesce(a.electorate,'') = coalesce(b.electorate,'');

-- Add a uniqueness guard to prevent future dupes
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mps_name_electorate_unique'
  ) then
    alter table public.mps
      add constraint mps_name_electorate_unique unique (name, electorate);
  end if;
end$$;
