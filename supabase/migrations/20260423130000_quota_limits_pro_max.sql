-- Align quota caps with docs/PRODUCT.md (Free 30/60/60, Pro 500 each, Max unlimited docs + 2000 gate/visitor).

create or replace function public.quota_limit_for_org(p_org_id uuid, p_metric usage_metric)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case o.plan
    when 'free' then
      case p_metric
        when 'documents_combined' then 30
        when 'gate_passes' then 60
        when 'visitor_passes' then 60
      end
    when 'pro' then 500
    when 'max' then
      case p_metric
        when 'documents_combined' then null::int
        when 'gate_passes' then 2000
        when 'visitor_passes' then 2000
      end
  end
  from public.organizations o
  where o.id = p_org_id;
$$;

revoke all on function public.quota_limit_for_org(uuid, usage_metric) from public;
grant execute on function public.quota_limit_for_org(uuid, usage_metric) to authenticated;
