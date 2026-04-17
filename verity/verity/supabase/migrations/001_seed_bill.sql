with b as (
  insert into public.bills (title,chamber,stage,source_url)
  values ('Electoral Reform Bill 2025','House','Second reading','https://example.org/bill/er-2025')
  returning id
)
insert into public.bill_sections (bill_id,ord,heading,text)
select id,1,'Overview','Reforms preferential voting rules.' from b
union all
select id,2,'Key changes','Adjusts counting method and disclosure requirements.' from b;
