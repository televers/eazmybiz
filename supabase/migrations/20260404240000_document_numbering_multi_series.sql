-- Multi-series numbering (Pro: 3, Max: 5): slot-prefixed series_key; optional extra profiles in JSON.
-- Prefix existing sequence keys with slot 1 so parallel series do not collide.

alter table public.organizations
  add column if not exists doc_multi_series_enabled boolean not null default false,
  add column if not exists doc_series_profiles jsonb not null default '[]'::jsonb,
  add column if not exists doc_series_slot_quotation smallint not null default 1,
  add column if not exists doc_series_slot_packing_list smallint not null default 1,
  add column if not exists doc_series_slot_delivery_challan smallint not null default 1,
  add column if not exists doc_series_slot_gate_pass smallint not null default 1,
  add column if not exists doc_series_slot_visitor smallint not null default 1;

alter table public.organizations drop constraint if exists organizations_doc_series_slot_qt_check;
alter table public.organizations drop constraint if exists organizations_doc_series_slot_pl_check;
alter table public.organizations drop constraint if exists organizations_doc_series_slot_dc_check;
alter table public.organizations drop constraint if exists organizations_doc_series_slot_gp_check;
alter table public.organizations drop constraint if exists organizations_doc_series_slot_vs_check;

alter table public.organizations add constraint organizations_doc_series_slot_qt_check
  check (doc_series_slot_quotation >= 1 and doc_series_slot_quotation <= 5);
alter table public.organizations add constraint organizations_doc_series_slot_pl_check
  check (doc_series_slot_packing_list >= 1 and doc_series_slot_packing_list <= 5);
alter table public.organizations add constraint organizations_doc_series_slot_dc_check
  check (doc_series_slot_delivery_challan >= 1 and doc_series_slot_delivery_challan <= 5);
alter table public.organizations add constraint organizations_doc_series_slot_gp_check
  check (doc_series_slot_gate_pass >= 1 and doc_series_slot_gate_pass <= 5);
alter table public.organizations add constraint organizations_doc_series_slot_vs_check
  check (doc_series_slot_visitor >= 1 and doc_series_slot_visitor <= 5);

update public.document_sequences ds
set series_key =
  '1/' ||
  case
    when ds.series_key is null or btrim(ds.series_key) = '' then '~'
    else ds.series_key
  end
where not (ds.series_key ~ '^[0-9]+/');

create or replace function public.next_document_number(
  p_org_id uuid,
  p_doc_type text,
  p_reference_ymd date default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_next int;
  v_type text := lower(trim(p_doc_type));
  v_feature text;
  v_tz text;
  v_ref date;
  v_series text := '';
  v_store_key text;
  v_prefix text;
  v_fmt text;
  v_mode text;
  v_plan public.plan_tier;
  v_num text;
  v_slot int := 1;
  v_max_slots int := 1;
  y int;
  m int;
  start_year int;
  end_year int;
  cm int;
  cd int;
  ry int;
  dim int;
  cd_eff int;
  anchor_this date;
  anchor_prev date;
  v_prof jsonb;
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

  select * into v_org from public.organizations where id = p_org_id;
  if not found then
    raise exception 'organization not found';
  end if;

  v_plan := v_org.plan;
  v_tz := coalesce(nullif(trim(v_org.calendar_time_zone), ''), 'UTC');
  v_ref := coalesce(p_reference_ymd, (timezone(v_tz, now()))::date);

  if v_plan in ('pro', 'max') and coalesce(v_org.doc_multi_series_enabled, false) then
    v_max_slots := case when v_plan = 'max' then 5 else 3 end;
    v_slot := case v_type
      when 'qt' then coalesce(v_org.doc_series_slot_quotation, 1)
      when 'pl' then coalesce(v_org.doc_series_slot_packing_list, 1)
      when 'dc' then coalesce(v_org.doc_series_slot_delivery_challan, 1)
      when 'gp' then coalesce(v_org.doc_series_slot_gate_pass, 1)
      when 'vs' then coalesce(v_org.doc_series_slot_visitor, 1)
      else 1
    end;
    if v_slot < 1 or v_slot > v_max_slots then
      v_slot := 1;
    end if;
  else
    v_slot := 1;
  end if;

  if v_slot = 1 then
    v_mode := v_org.doc_series_mode;
    cm := v_org.doc_series_custom_month;
    cd := v_org.doc_series_custom_day;
  else
    v_prof := coalesce(v_org.doc_series_profiles, '[]'::jsonb) -> (v_slot - 2);
    if v_prof is null or jsonb_typeof(v_prof) <> 'object' then
      v_mode := 'year_april';
      cm := null;
      cd := null;
    else
      v_mode := coalesce(v_prof ->> 'mode', 'year_april');
      begin
        cm := (v_prof ->> 'month')::int;
      exception when others then
        cm := null;
      end;
      begin
        cd := (v_prof ->> 'day')::int;
      exception when others then
        cd := null;
      end;
    end if;
  end if;

  if v_plan = 'free' then
    v_slot := 1;
    v_mode := v_org.doc_series_mode;
    cm := v_org.doc_series_custom_month;
    cd := v_org.doc_series_custom_day;
    if v_mode = 'continuous' then
      v_mode := 'year_april';
    end if;
    if v_mode not in ('year_january', 'year_april', 'year_custom') then
      v_mode := 'year_april';
    end if;
  else
    if v_mode = 'continuous' then
      null;
    elsif v_mode = 'year_january' then
      null;
    elsif v_mode = 'year_april' then
      null;
    elsif v_mode = 'year_custom' then
      null;
    else
      v_mode := 'year_april';
      cm := null;
      cd := null;
    end if;
  end if;

  if v_mode = 'continuous' then
    v_series := '';
  elsif v_mode = 'year_january' then
    v_series := to_char(v_ref, 'YYYY');
  elsif v_mode = 'year_april' then
    y := extract(year from v_ref)::int;
    m := extract(month from v_ref)::int;
    if m >= 4 then
      start_year := y;
    else
      start_year := y - 1;
    end if;
    end_year := start_year + 1;
    v_series := start_year::text || '-' || lpad((end_year % 100)::text, 2, '0');
  elsif v_mode = 'year_custom' then
    if cm is null or cd is null or cm < 1 or cm > 12 or cd < 1 or cd > 31 then
      y := extract(year from v_ref)::int;
      m := extract(month from v_ref)::int;
      if m >= 4 then
        start_year := y;
      else
        start_year := y - 1;
      end if;
      end_year := start_year + 1;
      v_series := start_year::text || '-' || lpad((end_year % 100)::text, 2, '0');
    else
      ry := extract(year from v_ref)::int;
      dim := extract(day from (
        date_trunc('month', make_date(ry, cm, 1)) + interval '1 month - 1 day'
      )::date)::int;
      cd_eff := least(cd, dim);
      anchor_this := make_date(ry, cm, cd_eff);
      if v_ref < anchor_this then
        ry := ry - 1;
        dim := extract(day from (
          date_trunc('month', make_date(ry, cm, 1)) + interval '1 month - 1 day'
        )::date)::int;
        cd_eff := least(cd, dim);
        anchor_prev := make_date(ry, cm, cd_eff);
        v_series := to_char(anchor_prev, 'YYYY-MM-DD');
      else
        v_series := to_char(anchor_this, 'YYYY-MM-DD');
      end if;
    end if;
  else
    v_series := '';
  end if;

  v_store_key := v_slot::text || '/' || case when v_series = '' then '~' else v_series end;

  v_prefix := case v_type
    when 'qt' then nullif(trim(v_org.doc_prefix_quotation), '')
    when 'pl' then nullif(trim(v_org.doc_prefix_packing_list), '')
    when 'dc' then nullif(trim(v_org.doc_prefix_delivery_challan), '')
    when 'gp' then nullif(trim(v_org.doc_prefix_gate_pass), '')
    when 'vs' then nullif(trim(v_org.doc_prefix_visitor), '')
    else null
  end;

  if v_prefix is null then
    v_prefix := upper(v_type);
  end if;

  if v_plan = 'free' then
    v_prefix := case v_type
      when 'qt' then 'QT'
      when 'pl' then 'PL'
      when 'dc' then 'DC'
      when 'gp' then 'GP'
      when 'vs' then 'VP'
      else upper(v_type)
    end;
    v_fmt := 'dash';
  else
    v_fmt := v_org.doc_number_format;
    if v_fmt not in ('dash', 'slash') then
      v_fmt := 'dash';
    end if;
  end if;

  insert into public.document_sequences (organization_id, doc_type, series_key, last_number)
  values (p_org_id, v_type, v_store_key, 1)
  on conflict (organization_id, doc_type, series_key)
  do update set last_number = public.document_sequences.last_number + 1
  returning last_number into v_next;

  v_num := lpad(v_next::text, 5, '0');

  if v_fmt = 'slash' then
    return trim(both '/' from v_prefix) || '/' || v_num;
  end if;
  return v_prefix || '-' || v_num;
end;
$$;

revoke all on function public.next_document_number(uuid, text, date) from public;
grant execute on function public.next_document_number(uuid, text, date) to authenticated;
