-- Organization calendar timezone for document/visit dates (quotas remain IST per product).
-- Issue RPCs: block only *future* calendar dates in org TZ; allow backdating within app policy.

alter table public.organizations
  add column if not exists calendar_time_zone text;

update public.organizations o
set calendar_time_zone = case upper(trim(coalesce(o.country_code, '')))
  when 'IN' then 'Asia/Kolkata'
  when 'GB' then 'Europe/London'
  when 'DE' then 'Europe/Berlin'
  when 'FR' then 'Europe/Paris'
  when 'IT' then 'Europe/Rome'
  when 'ES' then 'Europe/Madrid'
  when 'NL' then 'Europe/Amsterdam'
  when 'AE' then 'Asia/Dubai'
  when 'SA' then 'Asia/Riyadh'
  when 'SG' then 'Asia/Singapore'
  when 'MY' then 'Asia/Kuala_Lumpur'
  when 'JP' then 'Asia/Tokyo'
  when 'KR' then 'Asia/Seoul'
  when 'CN' then 'Asia/Shanghai'
  when 'HK' then 'Asia/Hong_Kong'
  when 'AU' then 'Australia/Sydney'
  when 'NZ' then 'Pacific/Auckland'
  when 'ZA' then 'Africa/Johannesburg'
  when 'US' then 'America/New_York'
  when 'CA' then 'America/Toronto'
  when 'BR' then 'America/Sao_Paulo'
  when 'MX' then 'America/Mexico_City'
  else 'UTC'
end
where o.calendar_time_zone is null;

update public.organizations
set calendar_time_zone = 'UTC'
where calendar_time_zone is null or trim(calendar_time_zone) = '';

alter table public.organizations
  alter column calendar_time_zone set default 'UTC';

alter table public.organizations
  alter column calendar_time_zone set not null;

-- --- issue_quotation: block future document_date ---
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
  v_tz text;
  v_today date;
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

-- --- issue_packing_list ---
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
  v_tz text;
  v_today date;
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

-- --- issue_delivery_challan: future only (allow backdate per app) ---
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
  v_tz text;
  v_today date;
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

-- --- issue_gate_pass ---
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
  if v_row.document_date > v_today then
    return jsonb_build_object('ok', false, 'error', 'document date cannot be in the future');
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

-- --- issue_visitor_pass: block future visit_date only ---
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
  if v_row.visit_date > v_today then
    return jsonb_build_object('ok', false, 'error', 'visit date cannot be in the future');
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
