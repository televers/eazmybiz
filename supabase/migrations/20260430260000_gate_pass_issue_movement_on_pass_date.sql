-- Material gate pass: cannot issue until organization calendar has reached the pass date (document_date).
-- Material movement cannot be recorded before that date (trigger + app).

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
  if v_today < v_row.document_date then
    return jsonb_build_object('ok', false, 'error', 'cannot issue before pass date');
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

create or replace function public.gate_passes_enforce_material_movement_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_today date;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.material_moved_at is not null and old.material_moved_at is null then
    if new.status <> 'issued'::public.doc_status then
      raise exception 'material movement only after gate pass is issued';
    end if;
    select coalesce(nullif(trim(calendar_time_zone), ''), 'UTC') into v_tz
    from public.organizations where id = new.organization_id;
    v_today := (now() at time zone v_tz)::date;
    if v_today < new.document_date then
      raise exception 'material movement only on or after pass date';
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

revoke all on function public.gate_passes_enforce_material_movement_record() from public;
