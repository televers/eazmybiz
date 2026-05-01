-- Queue multiple pending profile change requests per company (no longer replace on submit).
-- Optional structured detail lines on settings activity (full notifications page).

drop index if exists public.organization_profile_change_one_pending_idx;

alter table public.organization_settings_activity
  add column if not exists detail jsonb;

comment on column public.organization_settings_activity.detail is
  'Optional array of strings (e.g. field change lines). Bell preview uses summary only.';

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
