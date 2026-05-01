-- Parties and saved items: creator becomes maintainer (managed_by_user_id). Only the maintainer or
-- company admins / account owner may update or delete. All members with module access may still read
-- (use in documents). On member deactivation (Pro/Max), masters maintained by that user are reassigned
-- to an active company admin, or the account owner if none.

alter table public.parties
  add column if not exists managed_by_user_id uuid references auth.users (id) on delete set null;

alter table public.saved_item_presets
  add column if not exists managed_by_user_id uuid references auth.users (id) on delete set null;

create index if not exists parties_org_managed_by_idx on public.parties (organization_id, managed_by_user_id);
create index if not exists saved_item_presets_org_managed_by_idx
  on public.saved_item_presets (organization_id, managed_by_user_id);

-- Admins/owner, or the assigned maintainer (non-null). Legacy rows with null maintainer: admins only.
create or replace function public.member_can_edit_org_master(p_org_id uuid, p_managed_by uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_memberships(p_org_id)
    or (p_managed_by is not null and p_managed_by = auth.uid());
$$;

revoke all on function public.member_can_edit_org_master(uuid, uuid) from public;
grant execute on function public.member_can_edit_org_master(uuid, uuid) to authenticated;

create or replace function public.member_can_edit_party_by_id(p_party_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parties p
    where p.id = p_party_id
      and public.member_can_edit_org_master(p.organization_id, p.managed_by_user_id)
  );
$$;

revoke all on function public.member_can_edit_party_by_id(uuid) from public;
grant execute on function public.member_can_edit_party_by_id(uuid) to authenticated;

create or replace function public.set_master_managed_by_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.managed_by_user_id is null and auth.uid() is not null then
    new.managed_by_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_parties_managed_by_insert on public.parties;
create trigger trg_parties_managed_by_insert
  before insert on public.parties
  for each row execute function public.set_master_managed_by_on_insert();

drop trigger if exists trg_saved_item_presets_managed_by_insert on public.saved_item_presets;
create trigger trg_saved_item_presets_managed_by_insert
  before insert on public.saved_item_presets
  for each row execute function public.set_master_managed_by_on_insert();

create or replace function public.preserve_master_managed_by_unless_privileged()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_manage_memberships(new.organization_id) then
    return new;
  end if;
  new.managed_by_user_id := old.managed_by_user_id;
  return new;
end;
$$;

drop trigger if exists trg_parties_managed_by_preserve on public.parties;
create trigger trg_parties_managed_by_preserve
  before update on public.parties
  for each row execute function public.preserve_master_managed_by_unless_privileged();

drop trigger if exists trg_saved_item_presets_managed_by_preserve on public.saved_item_presets;
create trigger trg_saved_item_presets_managed_by_preserve
  before update on public.saved_item_presets
  for each row execute function public.preserve_master_managed_by_unless_privileged();

create or replace function public.pick_org_master_fallback_handler(p_org_id uuid, p_exclude_user uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_handler uuid;
  v_owner uuid;
begin
  select m.user_id into v_handler
  from public.memberships m
  where m.organization_id = p_org_id
    and m.is_active
    and m.is_company_admin
    and m.user_id is distinct from p_exclude_user
  order by m.created_at asc
  limit 1;

  if v_handler is not null then
    return v_handler;
  end if;

  select ae.owner_user_id into v_owner
  from public.organizations o
  inner join public.account_entitlements ae on ae.id = o.entitlement_id
  where o.id = p_org_id;

  if v_owner is not null and v_owner is distinct from p_exclude_user then
    return v_owner;
  end if;

  return v_owner;
end;
$$;

revoke all on function public.pick_org_master_fallback_handler(uuid, uuid) from public;
grant execute on function public.pick_org_master_fallback_handler(uuid, uuid) to authenticated;

create or replace function public.reassign_org_masters_from_user(p_org_id uuid, p_from_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.can_manage_memberships(p_org_id) then
    raise exception 'forbidden';
  end if;

  v_to := public.pick_org_master_fallback_handler(p_org_id, p_from_user);
  if v_to is null then
    return;
  end if;

  update public.parties
  set managed_by_user_id = v_to,
      updated_at = now()
  where organization_id = p_org_id
    and managed_by_user_id is not distinct from p_from_user;

  update public.saved_item_presets
  set managed_by_user_id = v_to
  where organization_id = p_org_id
    and managed_by_user_id is not distinct from p_from_user;
end;
$$;

revoke all on function public.reassign_org_masters_from_user(uuid, uuid) from public;
grant execute on function public.reassign_org_masters_from_user(uuid, uuid) to authenticated;

-- RLS: parties
drop policy if exists parties_update on public.parties;
drop policy if exists parties_delete on public.parties;
create policy parties_update on public.parties
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and public.member_can_edit_org_master(organization_id, managed_by_user_id)
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and public.member_can_edit_org_master(organization_id, managed_by_user_id)
  );
create policy parties_delete on public.parties
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and public.member_can_edit_org_master(organization_id, managed_by_user_id)
  );

-- RLS: party_addresses (mutations follow party maintainer / admin)
drop policy if exists party_addresses_insert on public.party_addresses;
drop policy if exists party_addresses_update on public.party_addresses;
drop policy if exists party_addresses_delete on public.party_addresses;
create policy party_addresses_insert on public.party_addresses
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and public.member_can_edit_party_by_id(party_id)
  );
create policy party_addresses_update on public.party_addresses
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and public.member_can_edit_party_by_id(party_id)
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and public.member_can_edit_party_by_id(party_id)
  );
create policy party_addresses_delete on public.party_addresses
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and public.member_can_edit_party_by_id(party_id)
  );

-- RLS: saved_item_presets
drop policy if exists saved_item_presets_update on public.saved_item_presets;
drop policy if exists saved_item_presets_delete on public.saved_item_presets;
create policy saved_item_presets_update on public.saved_item_presets
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'items')
    and public.member_can_edit_org_master(organization_id, managed_by_user_id)
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'items')
    and public.member_can_edit_org_master(organization_id, managed_by_user_id)
  );
create policy saved_item_presets_delete on public.saved_item_presets
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'items')
    and public.member_can_edit_org_master(organization_id, managed_by_user_id)
  );

-- After deactivating a member, reassign masters they maintained (Pro/Max only reaches here for deactivate).
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
  v_was_active boolean;
  v_max_admins int;
  v_admin_count int;
  v_already_admin boolean;
  v_org_admin_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select m.organization_id, m.user_id, m.is_company_admin, m.is_active
  into v_org, v_uid, v_was_admin, v_was_active
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
    p_is_active := true;
  end if;

  if v_plan = 'free'::public.plan_tier and p_is_active = false and coalesce(v_was_active, true) then
    raise exception 'deactivating team members is available on Pro and Max only';
  end if;

  if p_is_company_admin and v_plan = 'free'::public.plan_tier and not v_was_admin then
    raise exception 'free plan does not include company admin seats';
  end if;

  if p_is_company_admin and v_uid <> v_owner and not v_was_admin then
    if v_plan = 'pro'::public.plan_tier then
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

  if p_is_active = false
    and coalesce(v_was_active, true)
    and v_uid is distinct from v_owner
  then
    perform public.reassign_org_masters_from_user(v_org, v_uid);
  end if;
end;
$$;
