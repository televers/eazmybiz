-- Purchase orders: vendor-facing procurement document (mirrors quotations; counts toward documents_combined on issue).

alter table public.organizations
  add column if not exists doc_prefix_purchase_order text not null default 'PO',
  add column if not exists doc_series_slot_purchase_order smallint,
  add column if not exists purchase_order_terms text;

alter table public.organizations drop constraint if exists organizations_doc_series_slot_purchase_order_check;
alter table public.organizations add constraint organizations_doc_series_slot_purchase_order_check
  check (doc_series_slot_purchase_order is null or (doc_series_slot_purchase_order >= 1 and doc_series_slot_purchase_order <= 5));

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  doc_number text not null,
  status doc_status not null default 'draft',
  document_date date,
  currency text not null default 'INR',
  vendor_to jsonb not null default '{}'::jsonb,
  bill_to jsonb not null default '{}'::jsonb,
  ship_to jsonb not null default '{}'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  payment_term text not null default '',
  delivery_inco_term text not null default '',
  delivery_period text not null default '',
  valid_until date,
  terms_notes text,
  notes text,
  additional_charges jsonb not null default '[]'::jsonb,
  party_id uuid references public.parties (id) on delete set null,
  template packing_list_template not null default 'basic',
  numbering_series_slot smallint,
  issued_at timestamptz,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_by_display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, doc_number)
);

alter table public.purchase_orders drop constraint if exists purchase_orders_numbering_series_slot_check;
alter table public.purchase_orders add constraint purchase_orders_numbering_series_slot_check
  check (numbering_series_slot is null or (numbering_series_slot >= 1 and numbering_series_slot <= 5));

create index if not exists purchase_orders_org_idx on public.purchase_orders (organization_id);
create index if not exists purchase_orders_org_created_by_idx on public.purchase_orders (organization_id, created_by_user_id);
create index if not exists purchase_orders_party_id_idx on public.purchase_orders (party_id) where party_id is not null;

alter table public.purchase_orders enable row level security;

drop policy if exists po_select on public.purchase_orders;
create policy po_select on public.purchase_orders
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'purchase_order')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );

drop policy if exists po_write on public.purchase_orders;
create policy po_write on public.purchase_orders
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'purchase_order')
  );

drop policy if exists po_update on public.purchase_orders;
create policy po_update on public.purchase_orders
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'purchase_order')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'purchase_order')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );

drop policy if exists po_delete on public.purchase_orders;
create policy po_delete on public.purchase_orders
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'purchase_order')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );

drop trigger if exists trg_purchase_orders_created_by on public.purchase_orders;
create trigger trg_purchase_orders_created_by
  before insert or update on public.purchase_orders
  for each row execute function public.document_set_and_preserve_created_by();

-- Issue: same validations as quotation + vendor/bill/ship names; documents_combined quota (IST month).
create or replace function public.issue_purchase_order(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.purchase_orders%rowtype;
  v_period text := to_char((now() at time zone 'Asia/Kolkata'), 'YYYY-MM');
  v_current int;
  v_limit int;
  v_new int;
  v_tz text;
  v_today date;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select * into v_row from public.purchase_orders where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not found');
  end if;

  if not public.membership_feature_allowed(auth.uid(), v_row.organization_id, 'purchase_order') then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if not public.member_can_see_row_by_creator(v_row.organization_id, v_row.created_by_user_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_row.status <> 'draft' then
    return jsonb_build_object('ok', false, 'error', 'already issued');
  end if;

  if trim(coalesce(v_row.payment_term, '')) = '' or trim(coalesce(v_row.delivery_inco_term, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'terms required');
  end if;

  if trim(coalesce(v_row.delivery_period, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'delivery_period required');
  end if;

  if v_row.valid_until is null then
    return jsonb_build_object('ok', false, 'error', 'valid_until required');
  end if;

  if trim(coalesce(v_row.vendor_to->>'name', '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'vendor required');
  end if;

  if trim(coalesce(v_row.bill_to->>'name', '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'bill_to required');
  end if;

  if trim(coalesce(v_row.ship_to->>'name', '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'ship_to required');
  end if;

  select coalesce(nullif(trim(calendar_time_zone), ''), 'UTC') into v_tz
  from public.organizations where id = v_row.organization_id;
  v_today := (now() at time zone v_tz)::date;
  if v_row.document_date is not null and v_row.document_date > v_today then
    return jsonb_build_object('ok', false, 'error', 'document date cannot be in the future');
  end if;

  v_limit := public.quota_limit_for_org(v_row.organization_id, 'documents_combined');

  insert into public.usage_counters (organization_id, period_ym, metric, count)
  values (v_row.organization_id, v_period, 'documents_combined', 0)
  on conflict (organization_id, period_ym, metric) do nothing;

  select c.count into v_current
  from public.usage_counters c
  where c.organization_id = v_row.organization_id
    and c.period_ym = v_period
    and c.metric = 'documents_combined'
  for update;

  if coalesce(v_current, 0) >= v_limit then
    return jsonb_build_object('ok', false, 'error', 'quota exceeded', 'limit', v_limit, 'current', coalesce(v_current, 0));
  end if;

  update public.usage_counters
  set count = count + 1
  where organization_id = v_row.organization_id
    and period_ym = v_period
    and metric = 'documents_combined'
  returning count into v_new;

  update public.purchase_orders
  set status = 'issued',
      issued_at = now(),
      updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'current', v_new);
end;
$$;

revoke all on function public.issue_purchase_order(uuid) from public;
grant execute on function public.issue_purchase_order(uuid) to authenticated;

create or replace function public.delete_draft_purchase_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_status text;
  v_doc_number text;
  v_slot smallint;
  v_doc_date date;
  v_created_by uuid;
  v_serial int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select po.organization_id, po.status, po.doc_number, po.numbering_series_slot, po.document_date, po.created_by_user_id
  into v_org, v_status, v_doc_number, v_slot, v_doc_date, v_created_by
  from public.purchase_orders po
  where po.id = p_id;

  if not found then
    raise exception 'not found';
  end if;

  if not public.membership_feature_allowed(auth.uid(), v_org, 'purchase_order') then
    raise exception 'forbidden';
  end if;

  if not public.member_can_see_row_by_creator(v_org, v_created_by) then
    raise exception 'forbidden';
  end if;

  if v_status is distinct from 'draft' then
    raise exception 'only draft purchase orders can be deleted';
  end if;

  begin
    v_serial := (substring(trim(v_doc_number) from '(\d{5})$'))::int;
  exception when others then
    v_serial := null;
  end;

  if v_serial is not null then
    perform public.release_document_sequence_if_last(v_org, 'po', v_doc_date, v_slot, v_serial);
  end if;

  delete from public.purchase_orders where id = p_id and organization_id = v_org;
end;
$$;

revoke all on function public.delete_draft_purchase_order(uuid) from public;
grant execute on function public.delete_draft_purchase_order(uuid) to authenticated;

-- Backfill purchase_order feature for existing memberships (default on for office, off for gate).
update public.memberships m
set feature_permissions = m.feature_permissions || '{"purchase_order": true}'::jsonb
where m.role = 'office'::public.member_role
  and coalesce((m.feature_permissions->>'purchase_order')::boolean, false) = false
  and m.feature_permissions <> '{}'::jsonb;

update public.memberships m
set feature_permissions = m.feature_permissions || '{"purchase_order": false}'::jsonb
where m.role = 'gate'::public.member_role
  and not (m.feature_permissions ? 'purchase_order');

update public.memberships m
set feature_permissions = m.feature_permissions || '{"purchase_order": true}'::jsonb
where m.is_company_admin
  and not (m.feature_permissions ? 'purchase_order');
