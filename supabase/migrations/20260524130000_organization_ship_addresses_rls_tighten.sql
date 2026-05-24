-- Warehouse / shipping addresses: admins manage slots; PO users read + append via RPC only.

drop policy if exists organization_ship_addresses_all on public.organization_ship_addresses;

drop policy if exists organization_ship_addresses_select on public.organization_ship_addresses;
create policy organization_ship_addresses_select on public.organization_ship_addresses
  for select using (
    organization_id in (select public.user_org_ids())
    and (
      public.can_manage_memberships(organization_id)
      or public.membership_feature_allowed(auth.uid(), organization_id, 'purchase_order')
    )
  );

drop policy if exists organization_ship_addresses_insert on public.organization_ship_addresses;
create policy organization_ship_addresses_insert on public.organization_ship_addresses
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.can_manage_memberships(organization_id)
  );

drop policy if exists organization_ship_addresses_update on public.organization_ship_addresses;
create policy organization_ship_addresses_update on public.organization_ship_addresses
  for update using (
    organization_id in (select public.user_org_ids())
    and public.can_manage_memberships(organization_id)
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.can_manage_memberships(organization_id)
  );

drop policy if exists organization_ship_addresses_delete on public.organization_ship_addresses;
create policy organization_ship_addresses_delete on public.organization_ship_addresses
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.can_manage_memberships(organization_id)
  );

-- PO users may append the next free slot (1–3) when saving ship-to from a purchase order.
create or replace function public.append_org_ship_address_from_po(
  p_org_id uuid,
  p_name text,
  p_address_line1 text default null,
  p_address_line2 text default null,
  p_city text default null,
  p_state text default null,
  p_pin text default null,
  p_country text default null,
  p_gstin text default null,
  p_contact_name text default null,
  p_mobile text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot int;
  v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  if p_org_id is null or not (p_org_id in (select public.user_org_ids())) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if not public.membership_feature_allowed(auth.uid(), p_org_id, 'purchase_order') then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_name = '' then
    return jsonb_build_object('ok', false, 'error', 'name required');
  end if;

  select s into v_slot
  from generate_series(1, 3) as s
  where not exists (
    select 1
    from public.organization_ship_addresses o
    where o.organization_id = p_org_id
      and o.ship_slot = s
  )
  order by s
  limit 1;

  if v_slot is null then
    return jsonb_build_object('ok', false, 'error', 'no free slot');
  end if;

  insert into public.organization_ship_addresses (
    organization_id,
    ship_slot,
    label,
    name,
    address_line1,
    address_line2,
    city,
    state,
    pin,
    country,
    gstin,
    contact_name,
    mobile,
    updated_at
  ) values (
    p_org_id,
    v_slot,
    null,
    v_name,
    nullif(trim(coalesce(p_address_line1, '')), ''),
    nullif(trim(coalesce(p_address_line2, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_state, '')), ''),
    nullif(trim(coalesce(p_pin, '')), ''),
    nullif(trim(coalesce(p_country, '')), ''),
    nullif(trim(coalesce(p_gstin, '')), ''),
    nullif(trim(coalesce(p_contact_name, '')), ''),
    nullif(trim(coalesce(p_mobile, '')), ''),
    now()
  );

  return jsonb_build_object('ok', true, 'ship_slot', v_slot);
end;
$$;

revoke all on function public.append_org_ship_address_from_po(
  uuid, text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.append_org_ship_address_from_po(
  uuid, text, text, text, text, text, text, text, text, text, text
) to authenticated;
