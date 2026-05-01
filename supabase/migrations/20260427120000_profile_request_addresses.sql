-- Extend profile change requests: communication address; expand submit/approve RPCs.

alter table public.organization_profile_change_requests
  add column if not exists proposed_region text,
  add column if not exists proposed_org_address_line1 text,
  add column if not exists proposed_org_address_line2 text,
  add column if not exists proposed_org_city text,
  add column if not exists proposed_org_state text,
  add column if not exists proposed_org_pin text,
  add column if not exists proposed_org_country text;

drop function if exists public.submit_org_profile_change_request(uuid, text, text, text, text, text, text, text);

create or replace function public.submit_org_profile_change_request(
  p_org_id uuid,
  p_proposed_name text,
  p_proposed_gstin text,
  p_proposed_bank_account_holder_name text,
  p_proposed_bank_name text,
  p_proposed_bank_branch text,
  p_proposed_bank_account_no text,
  p_proposed_bank_ifsc text,
  p_proposed_region text,
  p_proposed_org_address_line1 text,
  p_proposed_org_address_line2 text,
  p_proposed_org_city text,
  p_proposed_org_state text,
  p_proposed_org_pin text,
  p_proposed_org_country text
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
    proposed_bank_ifsc,
    proposed_region,
    proposed_org_address_line1,
    proposed_org_address_line2,
    proposed_org_city,
    proposed_org_state,
    proposed_org_pin,
    proposed_org_country
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
    nullif(trim(p_proposed_bank_ifsc), ''),
    nullif(trim(p_proposed_region), ''),
    nullif(trim(p_proposed_org_address_line1), ''),
    nullif(trim(p_proposed_org_address_line2), ''),
    nullif(trim(p_proposed_org_city), ''),
    nullif(trim(p_proposed_org_state), ''),
    nullif(trim(p_proposed_org_pin), ''),
    nullif(trim(p_proposed_org_country), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_org_profile_change_request(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.submit_org_profile_change_request(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text
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
    bank_ifsc = r.proposed_bank_ifsc,
    region = r.proposed_region,
    org_address_line1 = r.proposed_org_address_line1,
    org_address_line2 = r.proposed_org_address_line2,
    org_city = r.proposed_org_city,
    org_state = r.proposed_org_state,
    org_pin = r.proposed_org_pin,
    org_country = r.proposed_org_country
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
