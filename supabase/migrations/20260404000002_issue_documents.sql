-- Atomic issue: quota + status in one transaction (idempotent: only from draft)

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

  if not exists (
    select 1 from public.memberships m
    where m.organization_id = v_row.organization_id
      and m.user_id = auth.uid()
      and m.is_active
  ) then
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

  if not exists (
    select 1 from public.memberships m
    where m.organization_id = v_row.organization_id
      and m.user_id = auth.uid()
      and m.is_active
  ) then
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

  if not exists (
    select 1 from public.memberships m
    where m.organization_id = v_row.organization_id
      and m.user_id = auth.uid()
      and m.is_active
  ) then
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

  if not exists (
    select 1 from public.memberships m
    where m.organization_id = v_row.organization_id
      and m.user_id = auth.uid()
      and m.is_active
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
