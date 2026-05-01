-- Visitor visit_date and material gate pass document_date: max org-calendar future offset is 15 days (was 365).

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
  v_tz text;
  v_today date;
  v_max date;
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

  select coalesce(nullif(trim(calendar_time_zone), ''), 'UTC') into v_tz
  from public.organizations where id = v_row.organization_id;
  v_today := (now() at time zone v_tz)::date;
  if v_row.visit_date < v_today then
    return jsonb_build_object('ok', false, 'error', 'visit date cannot be in the past');
  end if;
  v_max := v_today + 15;
  if v_row.visit_date > v_max then
    return jsonb_build_object('ok', false, 'error', 'visit date is too far in the future');
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
  v_tz text;
  v_today date;
  v_max date;
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

  select coalesce(nullif(trim(calendar_time_zone), ''), 'UTC') into v_tz
  from public.organizations where id = v_row.organization_id;
  v_today := (now() at time zone v_tz)::date;
  if v_row.document_date < v_today then
    return jsonb_build_object('ok', false, 'error', 'pass date cannot be in the past');
  end if;
  v_max := v_today + 15;
  if v_row.document_date > v_max then
    return jsonb_build_object('ok', false, 'error', 'pass date is too far in the future');
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
