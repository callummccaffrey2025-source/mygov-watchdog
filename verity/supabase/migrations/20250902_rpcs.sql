create or replace function public.politician_report_card(p_politician_id uuid)
returns table(
  avg_trust numeric,
  avg_transparency numeric,
  avg_fiscal numeric,
  avg_social_impact numeric,
  ratings_count bigint
) language sql stable as $$
  select
    avg(trust)::numeric(10,2),
    avg(transparency)::numeric(10,2),
    avg(fiscal)::numeric(10,2),
    avg(social_impact)::numeric(10,2),
    count(*)
  from public.rating
  where politician_id = p_politician_id;
$$;

create or replace function public.follow_bill(p_user_id uuid, p_bill_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.watch_bill(user_id, bill_id) values (p_user_id, p_bill_id)
  on conflict do nothing;
$$;

create or replace function public.unfollow_bill(p_user_id uuid, p_bill_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.watch_bill where user_id = p_user_id and bill_id = p_bill_id;
$$;
