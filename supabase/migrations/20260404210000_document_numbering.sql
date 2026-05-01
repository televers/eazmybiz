-- Configurable document prefixes, series (calendar / India FY), and number format for Pro/Max.
-- Free: fixed QT/PL/DC/GP/VP prefixes; series resets 1 Jan or 1 Apr only.

alter table public.document_sequences
  add column if not exists series_key text not null default '';

alter table public.document_sequences drop constraint if exists document_sequences_pkey;

alter table public.document_sequences
  add primary key (organization_id, doc_type, series_key);

alter table public.organizations
  add column if not exists doc_prefix_quotation text not null default 'QT',
  add column if not exists doc_prefix_packing_list text not null default 'PL',
  add column if not exists doc_prefix_delivery_challan text not null default 'DC',
  add column if not exists doc_prefix_gate_pass text not null default 'GP',
  add column if not exists doc_prefix_visitor text not null default 'VP',
  add column if not exists doc_series_mode text not null default 'continuous'
    check (doc_series_mode in ('continuous', 'year_january', 'year_april')),
  add column if not exists doc_number_format text not null default 'dash'
    check (doc_number_format in ('dash', 'slash'));

-- Free plan: start with India-style FY reset (admins can switch to January in settings).
update public.organizations
set doc_series_mode = 'year_april'
where plan = 'free'
  and doc_series_mode = 'continuous';

-- New Free companies: India-style FY reset by default (admins can switch to January in settings).
create or replace function public.bootstrap_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_ent uuid;
  v_region commercial_region := 'in';
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'already belongs to an organization';
  end if;

  insert into public.organizations (name, plan, commercial_region, doc_series_mode)
  values (coalesce(nullif(trim(p_name), ''), 'My company'), 'free', v_region, 'year_april')
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org, auth.uid(), 'office');

  insert into public.account_entitlements (owner_user_id, plan, commercial_region, max_companies)
  values (auth.uid(), 'free', v_region, public.plan_max_companies('free'::plan_tier))
  returning id into v_ent;

  update public.organizations
  set entitlement_id = v_ent
  where id = v_org;

  return v_org;
end;
$$;

revoke all on function public.bootstrap_organization(text) from public;
grant execute on function public.bootstrap_organization(text) to authenticated;

drop function if exists public.next_document_number(uuid, text);

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
  v_prefix text;
  v_fmt text;
  v_mode text;
  v_plan public.plan_tier;
  v_num text;
  y int;
  m int;
  start_year int;
  end_year int;
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

  v_mode := v_org.doc_series_mode;
  if v_plan = 'free' then
    if v_mode = 'continuous' then
      v_mode := 'year_april';
    end if;
    if v_mode not in ('year_january', 'year_april') then
      v_mode := 'year_april';
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
  else
    v_series := '';
  end if;

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
  values (p_org_id, v_type, v_series, 1)
  on conflict (organization_id, doc_type, series_key)
  do update set last_number = public.document_sequences.last_number + 1
  returning last_number into v_next;

  v_num := lpad(v_next::text, 5, '0');

  if v_series = '' then
    if v_fmt = 'slash' then
      return trim(both '/' from v_prefix) || '/' || v_num;
    end if;
    return v_prefix || '-' || v_num;
  end if;

  if v_fmt = 'slash' then
    return trim(both '/' from v_prefix) || '/' || v_series || '/' || v_num;
  end if;

  return v_prefix || '-' || v_series || '-' || v_num;
end;
$$;

revoke all on function public.next_document_number(uuid, text, date) from public;
grant execute on function public.next_document_number(uuid, text, date) to authenticated;
