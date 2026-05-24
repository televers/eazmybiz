-- Purchase order in release_document_sequence + delete_draft_purchase_order (po cases)

-- Track which numbering series slot allocated each sales document; release last-used sequence on draft delete.

alter table public.quotations
  add column if not exists numbering_series_slot smallint;

alter table public.quotations drop constraint if exists quotations_numbering_series_slot_check;
alter table public.quotations add constraint quotations_numbering_series_slot_check
  check (numbering_series_slot is null or (numbering_series_slot >= 1 and numbering_series_slot <= 5));

alter table public.packing_lists
  add column if not exists numbering_series_slot smallint;

alter table public.packing_lists drop constraint if exists packing_lists_numbering_series_slot_check;
alter table public.packing_lists add constraint packing_lists_numbering_series_slot_check
  check (numbering_series_slot is null or (numbering_series_slot >= 1 and numbering_series_slot <= 5));

alter table public.delivery_challans
  add column if not exists numbering_series_slot smallint;

alter table public.delivery_challans drop constraint if exists delivery_challans_numbering_series_slot_check;
alter table public.delivery_challans add constraint delivery_challans_numbering_series_slot_check
  check (numbering_series_slot is null or (numbering_series_slot >= 1 and numbering_series_slot <= 5));

-- Decrement document_sequences (or delete row) only when p_allocated_serial equals last_number for that series_key.
create or replace function public.release_document_sequence_if_last(
  p_org_id uuid,
  p_doc_type text,
  p_reference_ymd date,
  p_row_series_slot smallint,
  p_allocated_serial int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_type text := lower(trim(p_doc_type));
  v_feature text;
  v_tz text;
  v_ref date;
  v_series text := '';
  v_store_key text;
  v_mode text;
  v_plan public.plan_tier;
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
  v_def int;
  v_last int;
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
    when 'po' then 'purchase_order'
    else null
  end;

  if v_feature is null
     or not public.membership_feature_allowed(auth.uid(), p_org_id, v_feature) then
    raise exception 'forbidden';
  end if;

  if p_allocated_serial is null or p_allocated_serial < 1 then
    return;
  end if;

  select * into v_org from public.organizations where id = p_org_id;
  if not found then
    raise exception 'organization not found';
  end if;

  v_plan := v_org.plan;
  v_tz := coalesce(nullif(trim(v_org.calendar_time_zone), ''), 'UTC');
  v_ref := coalesce(p_reference_ymd, (timezone(v_tz, now()))::date);
  v_def := greatest(1, least(5, coalesce(v_org.doc_series_default_slot, 1)));

  v_max_slots := 1;
  if v_plan in ('pro', 'max') and coalesce(v_org.doc_multi_series_enabled, false) then
    v_max_slots := case when v_plan = 'max' then 5 else 3 end;
  end if;

  if v_plan = 'free' or not coalesce(v_org.doc_multi_series_enabled, false) then
    v_slot := 1;
  else
    v_slot := coalesce(p_row_series_slot::int, case v_type
      when 'qt' then coalesce(v_org.doc_series_slot_quotation, v_def)
      when 'pl' then coalesce(v_org.doc_series_slot_packing_list, v_def)
      when 'dc' then coalesce(v_org.doc_series_slot_delivery_challan, v_def)
      when 'gp' then coalesce(v_org.doc_series_slot_gate_pass, v_def)
      when 'vs' then coalesce(v_org.doc_series_slot_visitor, v_def)
      when 'po' then coalesce(v_org.doc_series_slot_purchase_order, v_def)
      else v_def
    end);
    if v_slot < 1 or v_slot > v_max_slots then
      v_slot := 1;
    end if;
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

  select last_number into v_last
  from public.document_sequences
  where organization_id = p_org_id and doc_type = v_type and series_key = v_store_key
  for update;

  if v_last is null or v_last <> p_allocated_serial then
    return;
  end if;

  if v_last <= 1 then
    delete from public.document_sequences
    where organization_id = p_org_id and doc_type = v_type and series_key = v_store_key;
  else
    update public.document_sequences
    set last_number = last_number - 1
    where organization_id = p_org_id and doc_type = v_type and series_key = v_store_key;
  end if;
end;
$$;

revoke all on function public.release_document_sequence_if_last(uuid, text, date, smallint, int) from public;
grant execute on function public.release_document_sequence_if_last(uuid, text, date, smallint, int) to authenticated;

create or replace function public.delete_draft_quotation(p_id uuid)
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

  select q.organization_id, q.status, q.doc_number, q.numbering_series_slot, q.document_date, q.created_by_user_id
  into v_org, v_status, v_doc_number, v_slot, v_doc_date, v_created_by
  from public.quotations q
  where q.id = p_id;

  if not found then
    raise exception 'not found';
  end if;

  if not public.membership_feature_allowed(auth.uid(), v_org, 'quotation') then
    raise exception 'forbidden';
  end if;

  if not public.member_can_see_row_by_creator(v_org, v_created_by) then
    raise exception 'forbidden';
  end if;

  if v_status is distinct from 'draft' then
    raise exception 'only draft quotations can be deleted';
  end if;

  begin
    v_serial := (substring(trim(v_doc_number) from '(\d{5})$'))::int;
  exception when others then
    v_serial := null;
  end;

  if v_serial is not null then
    perform public.release_document_sequence_if_last(v_org, 'qt', v_doc_date, v_slot, v_serial);
  end if;

  delete from public.quotations where id = p_id and organization_id = v_org;
end;
$$;

create or replace function public.delete_draft_packing_list(p_id uuid)
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

  select pl.organization_id, pl.status, pl.doc_number, pl.numbering_series_slot, pl.document_date, pl.created_by_user_id
  into v_org, v_status, v_doc_number, v_slot, v_doc_date, v_created_by
  from public.packing_lists pl
  where pl.id = p_id;

  if not found then
    raise exception 'not found';
  end if;

  if not public.membership_feature_allowed(auth.uid(), v_org, 'packing_list') then
    raise exception 'forbidden';
  end if;

  if not public.member_can_see_row_by_creator(v_org, v_created_by) then
    raise exception 'forbidden';
  end if;

  if v_status is distinct from 'draft' then
    raise exception 'only draft packing lists can be deleted';
  end if;

  begin
    v_serial := (substring(trim(v_doc_number) from '(\d{5})$'))::int;
  exception when others then
    v_serial := null;
  end;

  if v_serial is not null then
    perform public.release_document_sequence_if_last(v_org, 'pl', v_doc_date, v_slot, v_serial);
  end if;

  delete from public.packing_lists where id = p_id and organization_id = v_org;
end;
$$;

create or replace function public.delete_draft_delivery_challan(p_id uuid)
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

  select dc.organization_id, dc.status, dc.doc_number, dc.numbering_series_slot, dc.document_date, dc.created_by_user_id
  into v_org, v_status, v_doc_number, v_slot, v_doc_date, v_created_by
  from public.delivery_challans dc
  where dc.id = p_id;

  if not found then
    raise exception 'not found';
  end if;

  if not public.membership_feature_allowed(auth.uid(), v_org, 'delivery_challan') then
    raise exception 'forbidden';
  end if;

  if not public.member_can_see_row_by_creator(v_org, v_created_by) then
    raise exception 'forbidden';
  end if;

  if v_status is distinct from 'draft' then
    raise exception 'only draft delivery challans can be deleted';
  end if;

  begin
    v_serial := (substring(trim(v_doc_number) from '(\d{5})$'))::int;
  exception when others then
    v_serial := null;
  end;

  if v_serial is not null then
    perform public.release_document_sequence_if_last(v_org, 'dc', v_doc_date, v_slot, v_serial);
  end if;

  delete from public.delivery_challans where id = p_id and organization_id = v_org;
end;
$$;

revoke all on function public.delete_draft_quotation(uuid) from public;
grant execute on function public.delete_draft_quotation(uuid) to authenticated;

revoke all on function public.delete_draft_packing_list(uuid) from public;
grant execute on function public.delete_draft_packing_list(uuid) to authenticated;

revoke all on function public.delete_draft_delivery_challan(uuid) from public;
grant execute on function public.delete_draft_delivery_challan(uuid) to authenticated;
