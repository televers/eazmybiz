-- Company profile: pending approval for legal name, GSTIN, bank (company admin submits; account owner approves).
-- Activity log for company settings changes visible to account owner + company admins.

create table if not exists public.organization_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requested_by_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  proposed_name text not null,
  proposed_gstin text,
  proposed_bank_account_holder_name text,
  proposed_bank_name text,
  proposed_bank_branch text,
  proposed_bank_account_no text,
  proposed_bank_ifsc text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users (id) on delete set null,
  resolution_note text
);

create unique index if not exists organization_profile_change_one_pending_idx
  on public.organization_profile_change_requests (organization_id)
  where (status = 'pending');

create index if not exists organization_profile_change_requests_org_idx
  on public.organization_profile_change_requests (organization_id);

alter table public.organization_profile_change_requests enable row level security;

create policy org_profile_change_select on public.organization_profile_change_requests
  for select using (
    organization_id in (select public.user_org_ids())
    and public.can_manage_memberships(organization_id)
  );

create table if not exists public.organization_settings_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists organization_settings_activity_org_idx
  on public.organization_settings_activity (organization_id, created_at desc);

alter table public.organization_settings_activity enable row level security;

create policy org_settings_activity_select on public.organization_settings_activity
  for select using (
    organization_id in (select public.user_org_ids())
    and public.can_manage_memberships(organization_id)
  );

create policy org_settings_activity_insert on public.organization_settings_activity
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.can_manage_memberships(organization_id)
    and actor_user_id = auth.uid()
  );

-- Account owner (entitlement owner) for an organization.
create or replace function public.is_entitlement_owner_for_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations o
    inner join public.account_entitlements ae on ae.id = o.entitlement_id
    where o.id = p_org_id
      and ae.owner_user_id = auth.uid()
  );
$$;

revoke all on function public.is_entitlement_owner_for_org(uuid) from public;
grant execute on function public.is_entitlement_owner_for_org(uuid) to authenticated;

-- Company admin submits / replaces pending legal & bank snapshot (account owner must not use this).
create or replace function public.submit_org_profile_change_request(
  p_org_id uuid,
  p_proposed_name text,
  p_proposed_gstin text,
  p_proposed_bank_account_holder_name text,
  p_proposed_bank_name text,
  p_proposed_bank_branch text,
  p_proposed_bank_account_no text,
  p_proposed_bank_ifsc text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if public.is_entitlement_owner_for_org(p_org_id) then
    raise exception 'account owner applies these fields directly';
  end if;

  if not public.can_manage_memberships(p_org_id) then
    raise exception 'forbidden';
  end if;

  delete from public.organization_profile_change_requests
  where organization_id = p_org_id
    and status = 'pending';

  insert into public.organization_profile_change_requests (
    organization_id,
    requested_by_user_id,
    status,
    proposed_name,
    proposed_gstin,
    proposed_bank_account_holder_name,
    proposed_bank_name,
    proposed_bank_branch,
    proposed_bank_account_no,
    proposed_bank_ifsc
  )
  values (
    p_org_id,
    auth.uid(),
    'pending',
    trim(p_proposed_name),
    nullif(trim(p_proposed_gstin), ''),
    nullif(trim(p_proposed_bank_account_holder_name), ''),
    nullif(trim(p_proposed_bank_name), ''),
    nullif(trim(p_proposed_bank_branch), ''),
    nullif(trim(p_proposed_bank_account_no), ''),
    nullif(trim(p_proposed_bank_ifsc), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_org_profile_change_request(
  uuid, text, text, text, text, text, text, text
) from public;
grant execute on function public.submit_org_profile_change_request(
  uuid, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.master_approve_org_profile_change_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_ent uuid;
  v_owner uuid;
  r public.organization_profile_change_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into r
  from public.organization_profile_change_requests
  where id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'request not found or not pending';
  end if;

  v_org := r.organization_id;

  select o.entitlement_id into v_ent
  from public.organizations o
  where o.id = v_org;

  select ae.owner_user_id into v_owner
  from public.account_entitlements ae
  where ae.id = v_ent;

  if v_owner is null or v_owner is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  update public.organizations
  set
    name = r.proposed_name,
    gstin = r.proposed_gstin,
    bank_account_holder_name = r.proposed_bank_account_holder_name,
    bank_name = r.proposed_bank_name,
    bank_branch = r.proposed_bank_branch,
    bank_account_no = r.proposed_bank_account_no,
    bank_ifsc = r.proposed_bank_ifsc
  where id = v_org;

  update public.organization_profile_change_requests
  set
    status = 'approved',
    resolved_at = now(),
    resolved_by_user_id = auth.uid(),
    resolution_note = null
  where id = p_request_id;
end;
$$;

revoke all on function public.master_approve_org_profile_change_request(uuid) from public;
grant execute on function public.master_approve_org_profile_change_request(uuid) to authenticated;

create or replace function public.master_reject_org_profile_change_request(
  p_request_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_ent uuid;
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select organization_id into v_org
  from public.organization_profile_change_requests
  where id = p_request_id
    and status = 'pending';

  if v_org is null then
    raise exception 'request not found or not pending';
  end if;

  select o.entitlement_id into v_ent
  from public.organizations o
  where o.id = v_org;

  select ae.owner_user_id into v_owner
  from public.account_entitlements ae
  where ae.id = v_ent;

  if v_owner is null or v_owner is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  update public.organization_profile_change_requests
  set
    status = 'rejected',
    resolved_at = now(),
    resolved_by_user_id = auth.uid(),
    resolution_note = nullif(trim(p_note), '')
  where id = p_request_id;
end;
$$;

revoke all on function public.master_reject_org_profile_change_request(uuid, text) from public;
grant execute on function public.master_reject_org_profile_change_request(uuid, text) to authenticated;
