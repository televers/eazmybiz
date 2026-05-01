-- Pro: up to 2 company admins account-wide (excl. owner); each company may have at most one active company admin.

create or replace function public.plan_max_company_admins(p public.plan_tier)
returns integer
language sql
immutable
as $$
  select case p
    when 'free' then 0
    when 'pro' then 2
    when 'max' then 5
  end;
$$;

create or replace function public.admin_add_org_member(
  p_org_id uuid,
  p_email text,
  p_role public.member_role,
  p_feature_permissions jsonb,
  p_is_company_admin boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_ent uuid;
  v_plan public.plan_tier;
  v_owner uuid;
  v_max_users int;
  v_user_count int;
  v_in_account boolean;
  v_max_admins int;
  v_admin_count int;
  v_already_admin boolean;
  v_new_id uuid;
  v_perms jsonb;
  v_org_admin_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.can_manage_memberships(p_org_id) then
    raise exception 'forbidden';
  end if;

  select id into v_uid
  from auth.users
  where lower(trim(email)) = lower(trim(p_email))
  limit 1;

  if v_uid is null then
    raise exception 'no user with this email — they must sign up first';
  end if;

  if exists (
    select 1 from public.memberships m
    where m.organization_id = p_org_id and m.user_id = v_uid
  ) then
    raise exception 'this user is already on this company';
  end if;

  select o.entitlement_id into v_ent from public.organizations o where o.id = p_org_id;
  select ae.plan, ae.owner_user_id into v_plan, v_owner from public.account_entitlements ae where ae.id = v_ent;

  select exists (
    select 1
    from public.memberships m
    inner join public.organizations o2 on o2.id = m.organization_id
    where o2.entitlement_id = v_ent
      and m.user_id = v_uid
      and m.is_active
  ) into v_in_account;

  v_max_users := case v_plan
    when 'free' then 2
    when 'pro' then 10
    when 'max' then 50
  end;

  if not v_in_account then
    select count(distinct m.user_id)::int into v_user_count
    from public.memberships m
    inner join public.organizations o2 on o2.id = m.organization_id
    where o2.entitlement_id = v_ent and m.is_active;

    if v_user_count >= v_max_users then
      raise exception 'user limit reached for your plan';
    end if;
  end if;

  if v_uid = v_owner then
    p_is_company_admin := false;
  end if;

  if p_is_company_admin and v_plan = 'free'::public.plan_tier then
    raise exception 'free plan does not include company admin seats';
  end if;

  if p_is_company_admin and v_uid <> v_owner then
    select count(*)::int into v_org_admin_count
    from public.memberships m
    where m.organization_id = p_org_id
      and m.is_active
      and m.is_company_admin
      and m.user_id is distinct from v_owner;

    if v_org_admin_count >= 1 then
      raise exception 'this company already has a company admin';
    end if;

    select exists (
      select 1
      from public.memberships m
      inner join public.organizations o2 on o2.id = m.organization_id
      where o2.entitlement_id = v_ent
        and m.user_id = v_uid
        and m.is_active
        and m.is_company_admin
    ) into v_already_admin;

    if not v_already_admin then
      v_max_admins := public.plan_max_company_admins(v_plan);
      select count(distinct m.user_id)::int into v_admin_count
      from public.memberships m
      inner join public.organizations o2 on o2.id = m.organization_id
      where o2.entitlement_id = v_ent
        and m.is_active
        and m.is_company_admin
        and m.user_id <> v_owner;

      if v_admin_count >= v_max_admins then
        raise exception 'company admin limit reached for your plan';
      end if;
    end if;
  end if;

  v_perms := case
    when p_feature_permissions is null or p_feature_permissions = '{}'::jsonb then '{}'::jsonb
    else p_feature_permissions
  end;

  insert into public.memberships (
    organization_id,
    user_id,
    role,
    is_active,
    is_company_admin,
    feature_permissions
  )
  values (
    p_org_id,
    v_uid,
    p_role,
    true,
    coalesce(p_is_company_admin, false),
    v_perms
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function public.admin_update_membership(
  p_membership_id uuid,
  p_role public.member_role,
  p_feature_permissions jsonb,
  p_is_company_admin boolean,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_ent uuid;
  v_plan public.plan_tier;
  v_owner uuid;
  v_uid uuid;
  v_was_admin boolean;
  v_max_admins int;
  v_admin_count int;
  v_already_admin boolean;
  v_org_admin_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select m.organization_id, m.user_id, m.is_company_admin
  into v_org, v_uid, v_was_admin
  from public.memberships m
  where m.id = p_membership_id;

  if v_org is null then
    raise exception 'membership not found';
  end if;

  if not public.can_manage_memberships(v_org) then
    raise exception 'forbidden';
  end if;

  select o.entitlement_id into v_ent from public.organizations o where o.id = v_org;
  select ae.plan, ae.owner_user_id into v_plan, v_owner from public.account_entitlements ae where ae.id = v_ent;

  if v_uid = v_owner then
    p_is_company_admin := false;
  end if;

  if p_is_company_admin and v_plan = 'free'::public.plan_tier and not v_was_admin then
    raise exception 'free plan does not include company admin seats';
  end if;

  if p_is_company_admin and v_uid <> v_owner and not v_was_admin then
    select count(*)::int into v_org_admin_count
    from public.memberships m
    where m.organization_id = v_org
      and m.is_active
      and m.is_company_admin
      and m.user_id is distinct from v_owner
      and m.id <> p_membership_id;

    if v_org_admin_count >= 1 then
      raise exception 'this company already has a company admin';
    end if;

    select exists (
      select 1
      from public.memberships m
      inner join public.organizations o2 on o2.id = m.organization_id
      where o2.entitlement_id = v_ent
        and m.user_id = v_uid
        and m.is_active
        and m.is_company_admin
    ) into v_already_admin;

    if not v_already_admin then
      v_max_admins := public.plan_max_company_admins(v_plan);
      select count(distinct m.user_id)::int into v_admin_count
      from public.memberships m
      inner join public.organizations o2 on o2.id = m.organization_id
      where o2.entitlement_id = v_ent
        and m.is_active
        and m.is_company_admin
        and m.user_id <> v_owner
        and m.id <> p_membership_id;

      if v_admin_count >= v_max_admins then
        raise exception 'company admin limit reached for your plan';
      end if;
    end if;
  end if;

  update public.memberships
  set
    role = p_role,
    is_company_admin = p_is_company_admin,
    is_active = p_is_active,
    feature_permissions = case
      when p_is_company_admin then
        '{"quotation":true,"packing_list":true,"delivery_challan":true,"gate_pass":true,"visitor":true,"parties":true,"items":true,"settings_company":true}'::jsonb
      else p_feature_permissions
    end
  where id = p_membership_id;

  update public.memberships m
  set feature_permissions = case m.role
    when 'office'::public.member_role then
      '{"quotation":true,"packing_list":true,"delivery_challan":true,"gate_pass":false,"visitor":true,"parties":true,"items":true,"settings_company":false}'::jsonb
    when 'gate'::public.member_role then
      '{"quotation":false,"packing_list":false,"delivery_challan":false,"gate_pass":true,"visitor":true,"parties":false,"items":false,"settings_company":false}'::jsonb
  end
  where m.id = p_membership_id
    and not m.is_company_admin
    and m.feature_permissions = '{}'::jsonb;
end;
$$;

-- Distinct active users (all roles) on the caller's entitlement — for team UI limits.
create or replace function public.entitlement_active_user_count_for_caller()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ent uuid;
  n int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select o.entitlement_id into v_ent
  from public.memberships m
  inner join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
    and m.is_active
  limit 1;

  if v_ent is null then
    select ae.id into v_ent from public.account_entitlements ae where ae.owner_user_id = auth.uid();
  end if;

  if v_ent is null then
    return 0;
  end if;

  select count(distinct m.user_id)::int into n
  from public.memberships m
  inner join public.organizations o on o.id = m.organization_id
  where o.entitlement_id = v_ent
    and m.is_active;

  return coalesce(n, 0);
end;
$$;

revoke all on function public.entitlement_active_user_count_for_caller() from public;
grant execute on function public.entitlement_active_user_count_for_caller() to authenticated;
