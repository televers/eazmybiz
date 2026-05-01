-- Non-admin members (office / gate) see only their own quotations, packing lists, delivery challans,
-- gate passes, and visitor records. Account owners and company admins see all org documents.
-- Legacy rows with created_by_user_id null remain visible to any member with module access.
-- SECURITY DEFINER issue_* RPCs and saved_item_preset_is_in_use must mirror this logic (RLS alone is not enough).

create or replace function public.member_can_see_row_by_creator(p_org_id uuid, p_created_by uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.can_manage_memberships(p_org_id) then
    return true;
  end if;

  if p_created_by is null then
    return true;
  end if;

  if p_created_by = auth.uid() then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.member_can_see_row_by_creator(uuid, uuid) from public;
grant execute on function public.member_can_see_row_by_creator(uuid, uuid) to authenticated;

-- Preset "in use" must scan all org documents; RLS would hide peers' rows for non-admins.
create or replace function public.saved_item_preset_is_in_use(p_organization_id uuid, p_preset_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not (p_organization_id in (select public.user_org_ids())) then
    raise exception 'forbidden';
  end if;

  if not public.membership_feature_allowed(auth.uid(), p_organization_id, 'items') then
    raise exception 'forbidden';
  end if;

  return coalesce(
    exists (
      select 1
      from public.quotations q
      where q.organization_id = p_organization_id
        and jsonb_typeof(q.lines) = 'array'
        and exists (
          select 1
          from jsonb_array_elements(q.lines) elem
          where nullif(elem->>'item_preset_id', '') = p_preset_id::text
        )
    )
    or exists (
      select 1
      from public.packing_lists pl
      where pl.organization_id = p_organization_id
        and jsonb_typeof(pl.packages) = 'array'
        and exists (
          select 1
          from jsonb_array_elements(pl.packages) pkg
          cross join lateral jsonb_array_elements(coalesce(pkg->'lines', '[]'::jsonb)) elem
          where nullif(elem->>'item_preset_id', '') = p_preset_id::text
        )
    )
    or exists (
      select 1
      from public.delivery_challans dc
      where dc.organization_id = p_organization_id
        and jsonb_typeof(dc.line_items) = 'array'
        and exists (
          select 1
          from jsonb_array_elements(dc.line_items) elem
          where nullif(elem->>'item_preset_id', '') = p_preset_id::text
        )
    ),
    false
  );
end;
$$;

revoke all on function public.saved_item_preset_is_in_use(uuid, uuid) from public;
grant execute on function public.saved_item_preset_is_in_use(uuid, uuid) to authenticated;

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

  if not public.member_can_see_row_by_creator(v_row.organization_id, v_row.created_by_user_id) then
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

  if not public.member_can_see_row_by_creator(v_row.organization_id, v_row.created_by_user_id) then
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

  if not public.member_can_see_row_by_creator(v_row.organization_id, v_row.created_by_user_id) then
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

  if not (
    public.member_can_see_row_by_creator(v_row.organization_id, v_row.created_by_user_id)
    or public.user_can_record_visitor_checkpoint(auth.uid(), v_row.organization_id)
  ) then
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

-- Visitor desk / gate movement: designated roles must open and update others' rows (check-in, material moved).
drop policy if exists vv_select on public.visitor_visits;
drop policy if exists vv_write on public.visitor_visits;
drop policy if exists vv_update on public.visitor_visits;
drop policy if exists vv_delete on public.visitor_visits;
create policy vv_select on public.visitor_visits
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'visitor')
    and (
      public.member_can_see_row_by_creator(organization_id, created_by_user_id)
      or public.user_can_record_visitor_checkpoint(auth.uid(), organization_id)
    )
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
    and (
      public.member_can_see_row_by_creator(organization_id, created_by_user_id)
      or public.user_can_record_visitor_checkpoint(auth.uid(), organization_id)
    )
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'visitor')
    and (
      public.member_can_see_row_by_creator(organization_id, created_by_user_id)
      or public.user_can_record_visitor_checkpoint(auth.uid(), organization_id)
    )
  );
create policy vv_delete on public.visitor_visits
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'visitor')
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
    and (
      public.member_can_see_row_by_creator(organization_id, created_by_user_id)
      or public.user_can_record_material_movement(auth.uid(), organization_id)
    )
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
    and (
      public.member_can_see_row_by_creator(organization_id, created_by_user_id)
      or public.user_can_record_material_movement(auth.uid(), organization_id)
    )
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'gate_pass')
    and (
      public.member_can_see_row_by_creator(organization_id, created_by_user_id)
      or public.user_can_record_material_movement(auth.uid(), organization_id)
    )
  );
create policy gp_delete on public.gate_passes
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'gate_pass')
    and public.member_can_see_row_by_creator(organization_id, created_by_user_id)
  );
