-- Checkpoint-style permissions: visitor check-in/out and material gate movement recording.
-- See app: memberships.feature_permissions keys visitor_checkpoint, material_movement.

alter table public.gate_passes
  add column if not exists material_moved_at timestamptz,
  add column if not exists material_moved_by_user_id uuid references auth.users (id) on delete set null;

create index if not exists gate_passes_org_material_moved_idx
  on public.gate_passes (organization_id, material_moved_at)
  where material_moved_at is not null;

-- Role defaults for checkpoint flags (must match src/lib/access.ts).
create or replace function public.membership_default_checkpoint_flag(p_role public.member_role, p_key text)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_key = 'visitor_checkpoint' or p_key = 'material_movement' then
    return p_role = 'gate'::public.member_role;
  end if;
  return false;
end;
$$;

create or replace function public.membership_effective_checkpoint_flag(
  p_role public.member_role,
  p_fp jsonb,
  p_key text
)
returns boolean
language sql
immutable
as $$
  select coalesce((p_fp ->> p_key)::boolean, public.membership_default_checkpoint_flag(p_role, p_key));
$$;

-- At least one non-owner, non-company-admin member is designated for visitor desk (check-in/out).
create or replace function public.org_has_visitor_checkpoint_assignee(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    inner join public.organizations o on o.id = m.organization_id
    inner join public.account_entitlements ae on ae.id = o.entitlement_id
    where m.organization_id = p_org
      and m.is_active
      and m.is_company_admin = false
      and m.user_id <> ae.owner_user_id
      and public.membership_feature_allowed(m.user_id, p_org, 'visitor')
      and public.membership_effective_checkpoint_flag(m.role, coalesce(m.feature_permissions, '{}'::jsonb), 'visitor_checkpoint')
  );
$$;

create or replace function public.org_has_material_movement_assignee(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    inner join public.organizations o on o.id = m.organization_id
    inner join public.account_entitlements ae on ae.id = o.entitlement_id
    where m.organization_id = p_org
      and m.is_active
      and m.is_company_admin = false
      and m.user_id <> ae.owner_user_id
      and public.membership_feature_allowed(m.user_id, p_org, 'gate_pass')
      and public.membership_effective_checkpoint_flag(m.role, coalesce(m.feature_permissions, '{}'::jsonb), 'material_movement')
  );
$$;

create or replace function public.user_can_record_visitor_checkpoint(p_user uuid, p_org uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ent uuid;
  v_owner uuid;
  r record;
begin
  if p_user is null then
    return false;
  end if;

  if not public.membership_feature_allowed(p_user, p_org, 'visitor') then
    return false;
  end if;

  select o.entitlement_id into v_ent from public.organizations o where o.id = p_org;
  if v_ent is not null then
    select ae.owner_user_id into v_owner from public.account_entitlements ae where ae.id = v_ent;
    if v_owner is not null and v_owner = p_user then
      return true;
    end if;
  end if;

  if exists (
    select 1
    from public.memberships m
    where m.organization_id = p_org
      and m.user_id = p_user
      and m.is_active
      and m.is_company_admin
  ) then
    return true;
  end if;

  if not public.org_has_visitor_checkpoint_assignee(p_org) then
    return true;
  end if;

  select m.role, m.feature_permissions into r
  from public.memberships m
  where m.organization_id = p_org
    and m.user_id = p_user
    and m.is_active
  limit 1;

  if not found then
    return false;
  end if;

  return public.membership_effective_checkpoint_flag(
    r.role,
    coalesce(r.feature_permissions, '{}'::jsonb),
    'visitor_checkpoint'
  );
end;
$$;

create or replace function public.user_can_record_material_movement(p_user uuid, p_org uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ent uuid;
  v_owner uuid;
  r record;
begin
  if p_user is null then
    return false;
  end if;

  if not public.membership_feature_allowed(p_user, p_org, 'gate_pass') then
    return false;
  end if;

  select o.entitlement_id into v_ent from public.organizations o where o.id = p_org;
  if v_ent is not null then
    select ae.owner_user_id into v_owner from public.account_entitlements ae where ae.id = v_ent;
    if v_owner is not null and v_owner = p_user then
      return true;
    end if;
  end if;

  if exists (
    select 1
    from public.memberships m
    where m.organization_id = p_org
      and m.user_id = p_user
      and m.is_active
      and m.is_company_admin
  ) then
    return true;
  end if;

  if not public.org_has_material_movement_assignee(p_org) then
    return true;
  end if;

  select m.role, m.feature_permissions into r
  from public.memberships m
  where m.organization_id = p_org
    and m.user_id = p_user
    and m.is_active
  limit 1;

  if not found then
    return false;
  end if;

  return public.membership_effective_checkpoint_flag(
    r.role,
    coalesce(r.feature_permissions, '{}'::jsonb),
    'material_movement'
  );
end;
$$;

revoke all on function public.membership_default_checkpoint_flag(public.member_role, text) from public;
revoke all on function public.membership_effective_checkpoint_flag(public.member_role, jsonb, text) from public;
revoke all on function public.org_has_visitor_checkpoint_assignee(uuid) from public;
revoke all on function public.org_has_material_movement_assignee(uuid) from public;
revoke all on function public.user_can_record_visitor_checkpoint(uuid, uuid) from public;
revoke all on function public.user_can_record_material_movement(uuid, uuid) from public;

grant execute on function public.membership_default_checkpoint_flag(public.member_role, text) to authenticated;
grant execute on function public.membership_effective_checkpoint_flag(public.member_role, jsonb, text) to authenticated;
grant execute on function public.org_has_visitor_checkpoint_assignee(uuid) to authenticated;
grant execute on function public.org_has_material_movement_assignee(uuid) to authenticated;
grant execute on function public.user_can_record_visitor_checkpoint(uuid, uuid) to authenticated;
grant execute on function public.user_can_record_material_movement(uuid, uuid) to authenticated;

-- Backfill checkpoint keys on memberships (explicit JSON for SQL helpers).
update public.memberships m
set feature_permissions = coalesce(m.feature_permissions, '{}'::jsonb)
  || jsonb_build_object(
    'visitor_checkpoint',
    public.membership_default_checkpoint_flag(m.role, 'visitor_checkpoint'),
    'material_movement',
    public.membership_default_checkpoint_flag(m.role, 'material_movement')
  )
where not coalesce(m.feature_permissions, '{}'::jsonb) ? 'visitor_checkpoint';

-- Enforce visitor check-in/out at database level (in addition to app checks).
create or replace function public.visitor_visits_enforce_checkpoint_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status = 'draft'::public.visitor_status and new.status = 'issued'::public.visitor_status then
    return new;
  end if;

  if new.status = 'checked_in'::public.visitor_status and old.status = 'issued'::public.visitor_status then
    if not public.user_can_record_visitor_checkpoint(auth.uid(), new.organization_id) then
      raise exception 'not allowed to check in visitors';
    end if;
    return new;
  end if;

  if new.status = 'checked_out'::public.visitor_status and old.status = 'checked_in'::public.visitor_status then
    if not public.user_can_record_visitor_checkpoint(auth.uid(), new.organization_id) then
      raise exception 'not allowed to check out visitors';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'invalid visitor status transition';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_visitor_visits_checkpoint on public.visitor_visits;
create trigger trg_visitor_visits_checkpoint
  before update on public.visitor_visits
  for each row
  execute procedure public.visitor_visits_enforce_checkpoint_transition();

revoke all on function public.visitor_visits_enforce_checkpoint_transition() from public;

-- One-time material movement timestamp on issued gate passes.
create or replace function public.gate_passes_enforce_material_movement_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.material_moved_at is not null and old.material_moved_at is null then
    if new.status <> 'issued'::public.doc_status then
      raise exception 'material movement only after gate pass is issued';
    end if;
    if not public.user_can_record_material_movement(auth.uid(), new.organization_id) then
      raise exception 'not allowed to record material movement';
    end if;
    new.material_moved_by_user_id := auth.uid();
    return new;
  end if;

  if new.material_moved_at is distinct from old.material_moved_at then
    raise exception 'material movement already recorded';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_gate_passes_material_movement on public.gate_passes;
create trigger trg_gate_passes_material_movement
  before update on public.gate_passes
  for each row
  execute procedure public.gate_passes_enforce_material_movement_record();

revoke all on function public.gate_passes_enforce_material_movement_record() from public;
