-- bootstrap_organization: optional org country (ISO alpha-2) + commercial_region from country
drop function if exists public.bootstrap_organization(text);

create or replace function public.bootstrap_organization(
  p_name text,
  p_country_code text default 'IN'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_ent uuid;
  v_cc text := upper(nullif(trim(p_country_code), ''));
  v_region public.commercial_region;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'already belongs to an organization';
  end if;

  if v_cc is null or v_cc = '' then
    v_cc := 'IN';
  end if;

  if length(v_cc) <> 2 then
    raise exception 'country code must be ISO alpha-2';
  end if;

  if v_cc = 'IN' then
    v_region := 'in'::public.commercial_region;
  else
    v_region := 'intl'::public.commercial_region;
  end if;

  insert into public.organizations (name, plan, commercial_region, doc_series_mode, country_code)
  values (coalesce(nullif(trim(p_name), ''), 'My company'), 'free', v_region, 'year_april', v_cc)
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org, auth.uid(), 'office');

  insert into public.account_entitlements (owner_user_id, plan, commercial_region, max_companies)
  values (auth.uid(), 'free', v_region, public.plan_max_companies('free'::plan_tier))
  returning id into v_ent;

  update public.organizations
  set entitlement_id = v_ent
  where id = v_org;

  return v_org;
end;
$$;

revoke all on function public.bootstrap_organization(text, text) from public;
grant execute on function public.bootstrap_organization(text, text) to authenticated;
