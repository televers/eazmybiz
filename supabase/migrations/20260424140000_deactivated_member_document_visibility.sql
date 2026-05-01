-- Pro/Max: rows created by a user who is inactive on this org are visible only to account owner and company admins.
-- created_by_user_id set on insert; preserved on update. Free: deactivating members blocked; visibility unchanged.

alter table public.quotations
  add column if not exists created_by_user_id uuid references auth.users (id) on delete set null;

alter table public.packing_lists
  add column if not exists created_by_user_id uuid references auth.users (id) on delete set null;

alter table public.delivery_challans
  add column if not exists created_by_user_id uuid references auth.users (id) on delete set null;

alter table public.gate_passes
  add column if not exists created_by_user_id uuid references auth.users (id) on delete set null;

alter table public.visitor_visits
  add column if not exists created_by_user_id uuid references auth.users (id) on delete set null;

create index if not exists quotations_org_created_by_idx on public.quotations (organization_id, created_by_user_id);
create index if not exists packing_lists_org_created_by_idx on public.packing_lists (organization_id, created_by_user_id);
create index if not exists delivery_challans_org_created_by_idx on public.delivery_challans (organization_id, created_by_user_id);
create index if not exists gate_passes_org_created_by_idx on public.gate_passes (organization_id, created_by_user_id);
create index if not exists visitor_visits_org_created_by_idx on public.visitor_visits (organization_id, created_by_user_id);

-- Free: always visible to members with module access. Pro/Max: legacy null creator = visible to all; inactive creator = admins only.
create or replace function public.member_can_see_row_by_creator(p_org_id uuid, p_created_by uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan public.plan_tier;
  v_active boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  select o.plan into v_plan from public.organizations o where o.id = p_org_id;
  if v_plan is null then
    return false;
  end if;

  if v_plan = 'free'::public.plan_tier then
    return true;
  end if;

  if p_created_by is null then
    return true;
  end if;

  select m.is_active into v_active
  from public.memberships m
  where m.organization_id = p_org_id
    and m.user_id = p_created_by
  limit 1;

  if v_active is null then
    return true;
  end if;

  if v_active then
    return true;
  end if;

  return public.can_manage_memberships(p_org_id);
end;
$$;

revoke all on function public.member_can_see_row_by_creator(uuid, uuid) from public;
grant execute on function public.member_can_see_row_by_creator(uuid, uuid) to authenticated;

create or replace function public.document_set_and_preserve_created_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by_user_id is null and auth.uid() is not null then
      new.created_by_user_id := auth.uid();
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.created_by_user_id := old.created_by_user_id;
    return new;
  end if;
  return new;
end;
$$;

create trigger trg_quotations_created_by
  before insert or update on public.quotations
  for each row execute function public.document_set_and_preserve_created_by();

create trigger trg_packing_lists_created_by
  before insert or update on public.packing_lists
  for each row execute function public.document_set_and_preserve_created_by();

create trigger trg_delivery_challans_created_by
  before insert or update on public.delivery_challans
  for each row execute function public.document_set_and_preserve_created_by();

create trigger trg_gate_passes_created_by
  before insert or update on public.gate_passes
  for each row execute function public.document_set_and_preserve_created_by();

create trigger trg_visitor_visits_created_by
  before insert or update on public.visitor_visits
  for each row execute function public.document_set_and_preserve_created_by();

-- RLS: add creator visibility on read / mutate (not insert check — trigger fills creator).
drop policy if exists qt_select on public.quotations;
drop policy if exists qt_write on public.quotations;
drop policy if exists qt_update on public.quotations;
drop policy if exists qt_delete on public.quotations;
create policy qt_select on public.quotations
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'quotation')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );
create policy qt_write on public.quotations
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'quotation')
  );
create policy qt_update on public.quotations
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'quotation')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'quotation')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );
create policy qt_delete on public.quotations
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'quotation')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );

drop policy if exists pl_select on public.packing_lists;
drop policy if exists pl_write on public.packing_lists;
drop policy if exists pl_update on public.packing_lists;
drop policy if exists pl_delete on public.packing_lists;
create policy pl_select on public.packing_lists
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'packing_list')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );
create policy pl_write on public.packing_lists
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'packing_list')
  );
create policy pl_update on public.packing_lists
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'packing_list')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'packing_list')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );
create policy pl_delete on public.packing_lists
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'packing_list')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );

drop policy if exists dc_select on public.delivery_challans;
drop policy if exists dc_write on public.delivery_challans;
drop policy if exists dc_update on public.delivery_challans;
drop policy if exists dc_delete on public.delivery_challans;
create policy dc_select on public.delivery_challans
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'delivery_challan')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );
create policy dc_write on public.delivery_challans
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'delivery_challan')
  );
create policy dc_update on public.delivery_challans
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'delivery_challan')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'delivery_challan')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );
create policy dc_delete on public.delivery_challans
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'delivery_challan')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );

drop policy if exists gp_select on public.gate_passes;
drop policy if exists gp_write on public.gate_passes;
drop policy if exists gp_update on public.gate_passes;
drop policy if exists gp_delete on public.gate_passes;
create policy gp_select on public.gate_passes
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'gate_pass')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );
create policy gp_write on public.gate_passes
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'gate_pass')
  );
create policy gp_update on public.gate_passes
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'gate_pass')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'gate_pass')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );
create policy gp_delete on public.gate_passes
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'gate_pass')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );

drop policy if exists vv_select on public.visitor_visits;
drop policy if exists vv_write on public.visitor_visits;
drop policy if exists vv_update on public.visitor_visits;
drop policy if exists vv_delete on public.visitor_visits;
create policy vv_select on public.visitor_visits
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'visitor')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );
create policy vv_write on public.visitor_visits
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'visitor')
  );
create policy vv_update on public.visitor_visits
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'visitor')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'visitor')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );
create policy vv_delete on public.visitor_visits
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'visitor')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );

-- Block deactivating members on Free (Pro/Max only).
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
end;
$$;
