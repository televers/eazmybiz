-- Master admin (account owner), company admins, feature permissions, multi-company access.
-- Pro: max 1 company admin (besides owner); Max: 5; Free: 0.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.memberships
  add column if not exists is_company_admin boolean not null default false;

alter table public.memberships
  add column if not exists feature_permissions jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Helpers: plan caps for company-admin seats (not counting account owner)
-- ---------------------------------------------------------------------------
create or replace function public.plan_max_company_admins(p public.plan_tier)
returns integer
language sql
immutable
as $$
  select case p
    when 'free' then 0
    when 'pro' then 1
    when 'max' then 5
  end;
$$;

revoke all on function public.plan_max_company_admins(public.plan_tier) from public;
grant execute on function public.plan_max_company_admins(public.plan_tier) to authenticated;

-- Orgs the signed-in user may access: active memberships + all orgs on owned entitlements.
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.organization_id
  from public.memberships m
  where m.user_id = auth.uid() and m.is_active
  union
  select o.id
  from public.organizations o
  inner join public.account_entitlements ae on ae.id = o.entitlement_id
  where ae.owner_user_id = auth.uid();
$$;

revoke all on function public.user_org_ids() from public;
grant execute on function public.user_org_ids() to authenticated;

create or replace function public.can_manage_memberships(p_org_id uuid)
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
  )
  or exists (
    select 1
    from public.memberships m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.is_active
      and m.is_company_admin
  );
$$;

revoke all on function public.can_manage_memberships(uuid) from public;
grant execute on function public.can_manage_memberships(uuid) to authenticated;

-- Feature gate for RLS + SECURITY DEFINER RPCs (owner: full access; company admin: full; else JSON).
create or replace function public.membership_feature_allowed(p_user uuid, p_org uuid, p_feature text)
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
  select o.entitlement_id into v_ent from public.organizations o where o.id = p_org;
  if v_ent is null then
    return false;
  end if;

  select ae.owner_user_id into v_owner from public.account_entitlements ae where ae.id = v_ent;
  if v_owner is not null and v_owner = p_user then
    return true;
  end if;

  select m.is_company_admin, m.feature_permissions into r
  from public.memberships m
  where m.organization_id = p_org
    and m.user_id = p_user
    and m.is_active
  limit 1;

  if not found then
    return false;
  end if;

  if r.is_company_admin then
    return true;
  end if;

  return coalesce((r.feature_permissions->>p_feature)::boolean, false);
end;
$$;

revoke all on function public.membership_feature_allowed(uuid, uuid, text) from public;
grant execute on function public.membership_feature_allowed(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill permissions + ensure owner has a membership row on every org
-- ---------------------------------------------------------------------------
update public.memberships m
set feature_permissions = case m.role
  when 'office'::public.member_role then
    '{"quotation":true,"packing_list":true,"delivery_challan":true,"gate_pass":false,"visitor":true,"parties":true,"items":true,"settings_company":false}'::jsonb
  when 'gate'::public.member_role then
    '{"quotation":false,"packing_list":false,"delivery_challan":false,"gate_pass":true,"visitor":true,"parties":false,"items":false,"settings_company":false}'::jsonb
end
where m.feature_permissions = '{}'::jsonb;

insert into public.memberships (organization_id, user_id, role, is_active, is_company_admin, feature_permissions)
select
  o.id,
  ae.owner_user_id,
  'office'::public.member_role,
  true,
  false,
  '{"quotation":true,"packing_list":true,"delivery_challan":true,"gate_pass":true,"visitor":true,"parties":true,"items":true,"settings_company":true}'::jsonb
from public.organizations o
inner join public.account_entitlements ae on ae.id = o.entitlement_id
where not exists (
  select 1
  from public.memberships m
  where m.organization_id = o.id
    and m.user_id = ae.owner_user_id
);

-- ---------------------------------------------------------------------------
-- RLS: tighter org + membership writes; entitlement readable by company admins
-- ---------------------------------------------------------------------------
drop policy if exists org_update_admin on public.organizations;
create policy org_update_admin on public.organizations
  for update using (
    id in (select public.user_org_ids())
    and public.can_manage_memberships(id)
  );

drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.can_manage_memberships(organization_id)
  );

drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update using (
    organization_id in (select public.user_org_ids())
    and public.can_manage_memberships(organization_id)
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.can_manage_memberships(organization_id)
  );

drop policy if exists account_entitlements_select_scope on public.account_entitlements;
create policy account_entitlements_select_scope on public.account_entitlements
  for select using (
    exists (
      select 1
      from public.organizations o
      inner join public.memberships m on m.organization_id = o.id and m.is_active
      where o.entitlement_id = account_entitlements.id
        and m.user_id = auth.uid()
        and m.is_company_admin
    )
  );

-- ---------------------------------------------------------------------------
-- Document / master data RLS: feature-aware
-- ---------------------------------------------------------------------------
drop policy if exists qt_select on public.quotations;
drop policy if exists qt_write on public.quotations;
drop policy if exists qt_update on public.quotations;
drop policy if exists qt_delete on public.quotations;
create policy qt_select on public.quotations
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'quotation')
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
  );
create policy qt_delete on public.quotations
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'quotation')
  );

drop policy if exists pl_select on public.packing_lists;
drop policy if exists pl_write on public.packing_lists;
drop policy if exists pl_update on public.packing_lists;
drop policy if exists pl_delete on public.packing_lists;
create policy pl_select on public.packing_lists
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'packing_list')
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
  );
create policy pl_delete on public.packing_lists
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'packing_list')
  );

drop policy if exists dc_select on public.delivery_challans;
drop policy if exists dc_write on public.delivery_challans;
drop policy if exists dc_update on public.delivery_challans;
drop policy if exists dc_delete on public.delivery_challans;
create policy dc_select on public.delivery_challans
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'delivery_challan')
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
  );
create policy dc_delete on public.delivery_challans
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'delivery_challan')
  );

drop policy if exists gp_select on public.gate_passes;
drop policy if exists gp_write on public.gate_passes;
drop policy if exists gp_update on public.gate_passes;
drop policy if exists gp_delete on public.gate_passes;
create policy gp_select on public.gate_passes
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'gate_pass')
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
  );
create policy gp_delete on public.gate_passes
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'gate_pass')
  );

drop policy if exists vv_select on public.visitor_visits;
drop policy if exists vv_write on public.visitor_visits;
drop policy if exists vv_update on public.visitor_visits;
drop policy if exists vv_delete on public.visitor_visits;
create policy vv_select on public.visitor_visits
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'visitor')
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
  );
create policy vv_delete on public.visitor_visits
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'visitor')
  );

drop policy if exists parties_all on public.parties;
drop policy if exists parties_select on public.parties;
drop policy if exists parties_insert on public.parties;
drop policy if exists parties_update on public.parties;
drop policy if exists parties_delete on public.parties;
create policy parties_select on public.parties
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
  );
create policy parties_insert on public.parties
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
  );
create policy parties_update on public.parties
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
  );
create policy parties_delete on public.parties
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
  );

drop policy if exists party_addresses_all on public.party_addresses;
drop policy if exists party_addresses_select on public.party_addresses;
drop policy if exists party_addresses_insert on public.party_addresses;
drop policy if exists party_addresses_update on public.party_addresses;
drop policy if exists party_addresses_delete on public.party_addresses;
create policy party_addresses_select on public.party_addresses
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
  );
create policy party_addresses_insert on public.party_addresses
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
  );
create policy party_addresses_update on public.party_addresses
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
  );
create policy party_addresses_delete on public.party_addresses
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
  );

drop policy if exists saved_item_presets_all on public.saved_item_presets;
drop policy if exists saved_item_presets_select on public.saved_item_presets;
drop policy if exists saved_item_presets_insert on public.saved_item_presets;
drop policy if exists saved_item_presets_update on public.saved_item_presets;
drop policy if exists saved_item_presets_delete on public.saved_item_presets;
create policy saved_item_presets_select on public.saved_item_presets
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'items')
  );
create policy saved_item_presets_insert on public.saved_item_presets
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'items')
  );
create policy saved_item_presets_update on public.saved_item_presets
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'items')
  );
create policy saved_item_presets_delete on public.saved_item_presets
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'items')
  );

-- ---------------------------------------------------------------------------
-- Storage: logos (company settings) + visitor photos (visitor module)
-- ---------------------------------------------------------------------------
drop policy if exists org_logos_member_insert on storage.objects;
create policy org_logos_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-logos'
    and public.membership_feature_allowed(auth.uid(), split_part(name, '/', 1)::uuid, 'settings_company')
  );

drop policy if exists org_logos_member_update on storage.objects;
create policy org_logos_member_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'org-logos'
    and public.membership_feature_allowed(auth.uid(), split_part(name, '/', 1)::uuid, 'settings_company')
  );

drop policy if exists org_logos_member_delete on storage.objects;
create policy org_logos_member_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-logos'
    and public.membership_feature_allowed(auth.uid(), split_part(name, '/', 1)::uuid, 'settings_company')
  );

drop policy if exists visitor_photos_member_insert on storage.objects;
create policy visitor_photos_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'visitor-photos'
    and public.membership_feature_allowed(auth.uid(), split_part(name, '/', 1)::uuid, 'visitor')
  );

drop policy if exists visitor_photos_member_update on storage.objects;
create policy visitor_photos_member_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'visitor-photos'
    and public.membership_feature_allowed(auth.uid(), split_part(name, '/', 1)::uuid, 'visitor')
  );

drop policy if exists visitor_photos_member_delete on storage.objects;
create policy visitor_photos_member_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'visitor-photos'
    and public.membership_feature_allowed(auth.uid(), split_part(name, '/', 1)::uuid, 'visitor')
  );

-- ---------------------------------------------------------------------------
-- RPC: document numbers + issue flows (feature-aware; owner without row OK)
-- ---------------------------------------------------------------------------
create or replace function public.next_document_number(p_org_id uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
  v_type text := lower(trim(p_doc_type));
  v_feature text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_feature := case v_type
    when 'qt' then 'quotation'
    when 'pl' then 'packing_list'
    when 'dc' then 'delivery_challan'
    when 'gp' then 'gate_pass'
    when 'vs' then 'visitor'
    else null
  end;

  if v_feature is null
     or not public.membership_feature_allowed(auth.uid(), p_org_id, v_feature) then
    raise exception 'forbidden';
  end if;

  insert into public.document_sequences (organization_id, doc_type, last_number)
  values (p_org_id, v_type, 1)
  on conflict (organization_id, doc_type)
  do update set last_number = public.document_sequences.last_number + 1
  returning last_number into v_next;

  return upper(v_type) || '-' || lpad(v_next::text, 5, '0');
end;
$$;

revoke all on function public.next_document_number(uuid, text) from public;
grant execute on function public.next_document_number(uuid, text) to authenticated;

create or replace function public.issue_quotation(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.quotations%rowtype;
  v_period text := to_char((now() at time zone 'Asia/Kolkata'), 'YYYY-MM');
  v_current int;
  v_limit int;
  v_new int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select * into v_row from public.quotations where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not found');
  end if;

  if not public.membership_feature_allowed(auth.uid(), v_row.organization_id, 'quotation') then
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

  update public.quotations
  set status = 'issued',
      issued_at = now(),
      updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'current', v_new);
end;
$$;

revoke all on function public.issue_quotation(uuid) from public;
grant execute on function public.issue_quotation(uuid) to authenticated;

create or replace function public.issue_packing_list(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.packing_lists%rowtype;
  v_period text := to_char((now() at time zone 'Asia/Kolkata'), 'YYYY-MM');
  v_current int;
  v_limit int;
  v_new int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select * into v_row from public.packing_lists where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not found');
  end if;

  if not public.membership_feature_allowed(auth.uid(), v_row.organization_id, 'packing_list') then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_row.status <> 'draft' then
    return jsonb_build_object('ok', false, 'error', 'already issued');
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

  update public.packing_lists
  set status = 'issued',
      issued_at = now(),
      updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'current', v_new);
end;
$$;

revoke all on function public.issue_packing_list(uuid) from public;
grant execute on function public.issue_packing_list(uuid) to authenticated;

create or replace function public.issue_delivery_challan(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.delivery_challans%rowtype;
  v_period text := to_char((now() at time zone 'Asia/Kolkata'), 'YYYY-MM');
  v_current int;
  v_limit int;
  v_new int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select * into v_row from public.delivery_challans where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not found');
  end if;

  if not public.membership_feature_allowed(auth.uid(), v_row.organization_id, 'delivery_challan') then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_row.status <> 'draft' then
    return jsonb_build_object('ok', false, 'error', 'already issued');
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

  update public.delivery_challans
  set status = 'issued',
      issued_at = now(),
      updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'current', v_new);
end;
$$;

revoke all on function public.issue_delivery_challan(uuid) from public;
grant execute on function public.issue_delivery_challan(uuid) to authenticated;

create or replace function public.issue_gate_pass(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.gate_passes%rowtype;
  v_period text := to_char((now() at time zone 'Asia/Kolkata'), 'YYYY-MM');
  v_current int;
  v_limit int;
  v_new int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select * into v_row from public.gate_passes where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not found');
  end if;

  if not public.membership_feature_allowed(auth.uid(), v_row.organization_id, 'gate_pass') then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_row.status <> 'draft' then
    return jsonb_build_object('ok', false, 'error', 'already issued');
  end if;

  v_limit := public.quota_limit_for_org(v_row.organization_id, 'gate_passes');

  insert into public.usage_counters (organization_id, period_ym, metric, count)
  values (v_row.organization_id, v_period, 'gate_passes', 0)
  on conflict (organization_id, period_ym, metric) do nothing;

  select c.count into v_current
  from public.usage_counters c
  where c.organization_id = v_row.organization_id
    and c.period_ym = v_period
    and c.metric = 'gate_passes'
  for update;

  if coalesce(v_current, 0) >= v_limit then
    return jsonb_build_object('ok', false, 'error', 'quota exceeded', 'limit', v_limit, 'current', coalesce(v_current, 0));
  end if;

  update public.usage_counters
  set count = count + 1
  where organization_id = v_row.organization_id
    and period_ym = v_period
    and metric = 'gate_passes'
  returning count into v_new;

  update public.gate_passes
  set status = 'issued',
      issued_at = now(),
      updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'current', v_new);
end;
$$;

revoke all on function public.issue_gate_pass(uuid) from public;
grant execute on function public.issue_gate_pass(uuid) to authenticated;

create or replace function public.issue_visitor_pass(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.visitor_visits%rowtype;
  v_period text := to_char((now() at time zone 'Asia/Kolkata'), 'YYYY-MM');
  v_current int;
  v_limit int;
  v_new int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select * into v_row from public.visitor_visits where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not found');
  end if;

  if not public.membership_feature_allowed(auth.uid(), v_row.organization_id, 'visitor') then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_row.status <> 'draft' then
    return jsonb_build_object('ok', false, 'error', 'already issued');
  end if;

  v_limit := public.quota_limit_for_org(v_row.organization_id, 'visitor_passes');

  insert into public.usage_counters (organization_id, period_ym, metric, count)
  values (v_row.organization_id, v_period, 'visitor_passes', 0)
  on conflict (organization_id, period_ym, metric) do nothing;

  select c.count into v_current
  from public.usage_counters c
  where c.organization_id = v_row.organization_id
    and c.period_ym = v_period
    and c.metric = 'visitor_passes'
  for update;

  if coalesce(v_current, 0) >= v_limit then
    return jsonb_build_object('ok', false, 'error', 'quota exceeded', 'limit', v_limit, 'current', coalesce(v_current, 0));
  end if;

  update public.usage_counters
  set count = count + 1
  where organization_id = v_row.organization_id
    and period_ym = v_period
    and metric = 'visitor_passes'
  returning count into v_new;

  update public.visitor_visits
  set status = 'issued',
      issued_at = now(),
      updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'current', v_new);
end;
$$;

revoke all on function public.issue_visitor_pass(uuid) from public;
grant execute on function public.issue_visitor_pass(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: add company (owner only) + team management
-- ---------------------------------------------------------------------------
create or replace function public.create_company_for_account(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ent public.account_entitlements%rowtype;
  v_count int;
  v_org uuid;
  v_region public.commercial_region;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_ent from public.account_entitlements where owner_user_id = auth.uid();
  if not found then
    raise exception 'only the account owner can create additional companies';
  end if;

  select count(*)::int into v_count from public.organizations where entitlement_id = v_ent.id;
  if v_count >= v_ent.max_companies then
    raise exception 'company limit reached for your plan';
  end if;

  select o.commercial_region into v_region
  from public.organizations o
  where o.entitlement_id = v_ent.id
  limit 1;

  if v_region is null then
    v_region := v_ent.commercial_region;
  end if;

  insert into public.organizations (name, plan, commercial_region, entitlement_id)
  values (
    coalesce(nullif(trim(p_name), ''), 'New company'),
    v_ent.plan,
    v_region,
    v_ent.id
  )
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role, is_active, is_company_admin, feature_permissions)
  values (
    v_org,
    auth.uid(),
    'office'::public.member_role,
    true,
    false,
    '{"quotation":true,"packing_list":true,"delivery_challan":true,"gate_pass":true,"visitor":true,"parties":true,"items":true,"settings_company":true}'::jsonb
  );

  return v_org;
end;
$$;

revoke all on function public.create_company_for_account(text) from public;
grant execute on function public.create_company_for_account(text) to authenticated;

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

revoke all on function public.admin_add_org_member(uuid, text, public.member_role, jsonb, boolean) from public;
grant execute on function public.admin_add_org_member(uuid, text, public.member_role, jsonb, boolean) to authenticated;

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

revoke all on function public.admin_update_membership(uuid, public.member_role, jsonb, boolean, boolean) from public;
grant execute on function public.admin_update_membership(uuid, public.member_role, jsonb, boolean, boolean) to authenticated;

-- Default feature JSON on new rows (bootstrap + admin_add with empty perms).
create or replace function public.memberships_apply_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.is_company_admin then
    new.feature_permissions :=
      '{"quotation":true,"packing_list":true,"delivery_challan":true,"gate_pass":true,"visitor":true,"parties":true,"items":true,"settings_company":true}'::jsonb;
  elsif new.feature_permissions is null or new.feature_permissions = '{}'::jsonb then
    new.feature_permissions := case new.role
      when 'office'::public.member_role then
        '{"quotation":true,"packing_list":true,"delivery_challan":true,"gate_pass":false,"visitor":true,"parties":true,"items":true,"settings_company":false}'::jsonb
      when 'gate'::public.member_role then
        '{"quotation":false,"packing_list":false,"delivery_challan":false,"gate_pass":true,"visitor":true,"parties":false,"items":false,"settings_company":false}'::jsonb
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_memberships_defaults on public.memberships;
create trigger trg_memberships_defaults
  before insert on public.memberships
  for each row
  execute procedure public.memberships_apply_defaults();

-- Distinct company-admin users (excludes account owner) for the caller’s entitlement.
create or replace function public.entitlement_company_admin_count_for_caller()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ent uuid;
  v_owner uuid;
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
    and m.is_company_admin
  limit 1;

  if v_ent is null then
    select ae.id into v_ent from public.account_entitlements ae where ae.owner_user_id = auth.uid();
  end if;

  if v_ent is null then
    return 0;
  end if;

  select ae.owner_user_id into v_owner from public.account_entitlements ae where ae.id = v_ent;

  select count(distinct m.user_id)::int into n
  from public.memberships m
  inner join public.organizations o on o.id = m.organization_id
  where o.entitlement_id = v_ent
    and m.is_active
    and m.is_company_admin
    and m.user_id is distinct from v_owner;

  return coalesce(n, 0);
end;
$$;

revoke all on function public.entitlement_company_admin_count_for_caller() from public;
grant execute on function public.entitlement_company_admin_count_for_caller() to authenticated;
