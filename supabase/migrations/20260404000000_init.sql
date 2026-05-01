-- eazmybiz MVP schema: multi-tenant orgs, documents, usage (IST monthly)

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type plan_tier as enum ('free', 'pro', 'max');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type member_role as enum ('office', 'gate');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type doc_status as enum ('draft', 'issued');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type gate_direction as enum ('in', 'out');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type visitor_status as enum ('draft', 'issued', 'checked_in', 'checked_out');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type usage_metric as enum ('documents_combined', 'gate_passes', 'visitor_passes');
exception
  when duplicate_object then null;
end $$;

-- Core tables
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan plan_tier not null default 'free',
  country_code text not null default 'IN',
  region text,
  gstin text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null default 'office',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists memberships_user_id_idx on public.memberships (user_id);

create table if not exists public.document_sequences (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  doc_type text not null,
  last_number int not null default 0,
  primary key (organization_id, doc_type)
);

create table if not exists public.packing_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  doc_number text not null,
  status doc_status not null default 'draft',
  line_items jsonb not null default '[]'::jsonb,
  notes text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, doc_number)
);

create index if not exists packing_lists_org_idx on public.packing_lists (organization_id);

create table if not exists public.delivery_challans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  doc_number text not null,
  status doc_status not null default 'draft',
  line_items jsonb not null default '[]'::jsonb,
  vehicle_reg text,
  notes text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, doc_number)
);

create index if not exists delivery_challans_org_idx on public.delivery_challans (organization_id);

create table if not exists public.gate_passes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  doc_number text not null,
  direction gate_direction not null default 'out',
  status doc_status not null default 'draft',
  material_description text,
  party_name text,
  notes text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, doc_number)
);

create index if not exists gate_passes_org_idx on public.gate_passes (organization_id);

create table if not exists public.visitor_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  doc_number text not null,
  status visitor_status not null default 'draft',
  visitor_name text not null,
  visitor_company text,
  purpose text,
  host_name text,
  issued_at timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, doc_number)
);

create index if not exists visitor_visits_org_idx on public.visitor_visits (organization_id);

create table if not exists public.usage_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  period_ym text not null,
  metric usage_metric not null,
  count int not null default 0,
  primary key (organization_id, period_ym, metric)
);

-- Free tier limits (enforced in RPC); Pro/Max use high caps until billing
create or replace function public.quota_limit_for_org(p_org_id uuid, p_metric usage_metric)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case o.plan
    when 'free' then
      case p_metric
        when 'documents_combined' then 30
        when 'gate_passes' then 100
        when 'visitor_passes' then 100
      end
    else 1000000
  end
  from public.organizations o
  where o.id = p_org_id;
$$;

revoke all on function public.quota_limit_for_org(uuid, usage_metric) from public;
grant execute on function public.quota_limit_for_org(uuid, usage_metric) to authenticated;

-- Quota RPC: IST month, membership check, atomic increment under plan limit
create or replace function public.check_and_increment_usage(
  p_org_id uuid,
  p_metric usage_metric
)
returns table (ok boolean, current_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char((now() at time zone 'Asia/Kolkata'), 'YYYY-MM');
  v_current int;
  v_limit int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.is_active
  ) then
    raise exception 'not a member of this organization';
  end if;

  v_limit := public.quota_limit_for_org(p_org_id, p_metric);
  if v_limit is null then
    raise exception 'organization not found';
  end if;

  insert into public.usage_counters (organization_id, period_ym, metric, count)
  values (p_org_id, v_period, p_metric, 0)
  on conflict (organization_id, period_ym, metric) do nothing;

  select c.count into v_current
  from public.usage_counters c
  where c.organization_id = p_org_id
    and c.period_ym = v_period
    and c.metric = p_metric
  for update;

  if v_current is null then
    v_current := 0;
  end if;

  if v_current >= v_limit then
    return query select false, v_current;
    return;
  end if;

  update public.usage_counters
  set count = count + 1
  where organization_id = p_org_id
    and period_ym = v_period
    and metric = p_metric
  returning count into v_current;

  return query select true, v_current;
end;
$$;

revoke all on function public.check_and_increment_usage(uuid, usage_metric) from public;
grant execute on function public.check_and_increment_usage(uuid, usage_metric) to authenticated;

-- RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.document_sequences enable row level security;
alter table public.packing_lists enable row level security;
alter table public.delivery_challans enable row level security;
alter table public.gate_passes enable row level security;
alter table public.visitor_visits enable row level security;
alter table public.usage_counters enable row level security;

-- Helper: orgs visible to user
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.organization_id
  from public.memberships m
  where m.user_id = auth.uid() and m.is_active;
$$;

revoke all on function public.user_org_ids() from public;
grant execute on function public.user_org_ids() to authenticated;

-- Policies: organizations
drop policy if exists org_select_member on public.organizations;
create policy org_select_member on public.organizations
  for select using (id in (select public.user_org_ids()));

drop policy if exists org_update_admin on public.organizations;
create policy org_update_admin on public.organizations
  for update using (id in (select public.user_org_ids()));

-- Profiles: own row
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Memberships
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select using (organization_id in (select public.user_org_ids()));

drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert with check (organization_id in (select public.user_org_ids()));

drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update using (organization_id in (select public.user_org_ids()));

-- Document sequences
drop policy if exists docseq_all on public.document_sequences;
create policy docseq_all on public.document_sequences
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- Packing lists
drop policy if exists pl_select on public.packing_lists;
create policy pl_select on public.packing_lists
  for select using (organization_id in (select public.user_org_ids()));

drop policy if exists pl_write on public.packing_lists;
create policy pl_write on public.packing_lists
  for insert with check (organization_id in (select public.user_org_ids()));

drop policy if exists pl_update on public.packing_lists;
create policy pl_update on public.packing_lists
  for update using (organization_id in (select public.user_org_ids()));

drop policy if exists pl_delete on public.packing_lists;
create policy pl_delete on public.packing_lists
  for delete using (organization_id in (select public.user_org_ids()));

-- Delivery challans
drop policy if exists dc_select on public.delivery_challans;
create policy dc_select on public.delivery_challans
  for select using (organization_id in (select public.user_org_ids()));

drop policy if exists dc_write on public.delivery_challans;
create policy dc_write on public.delivery_challans
  for insert with check (organization_id in (select public.user_org_ids()));

drop policy if exists dc_update on public.delivery_challans;
create policy dc_update on public.delivery_challans
  for update using (organization_id in (select public.user_org_ids()));

drop policy if exists dc_delete on public.delivery_challans;
create policy dc_delete on public.delivery_challans
  for delete using (organization_id in (select public.user_org_ids()));

-- Gate passes
drop policy if exists gp_select on public.gate_passes;
create policy gp_select on public.gate_passes
  for select using (organization_id in (select public.user_org_ids()));

drop policy if exists gp_write on public.gate_passes;
create policy gp_write on public.gate_passes
  for insert with check (organization_id in (select public.user_org_ids()));

drop policy if exists gp_update on public.gate_passes;
create policy gp_update on public.gate_passes
  for update using (organization_id in (select public.user_org_ids()));

drop policy if exists gp_delete on public.gate_passes;
create policy gp_delete on public.gate_passes
  for delete using (organization_id in (select public.user_org_ids()));

-- Visitor visits
drop policy if exists vv_select on public.visitor_visits;
create policy vv_select on public.visitor_visits
  for select using (organization_id in (select public.user_org_ids()));

drop policy if exists vv_write on public.visitor_visits;
create policy vv_write on public.visitor_visits
  for insert with check (organization_id in (select public.user_org_ids()));

drop policy if exists vv_update on public.visitor_visits;
create policy vv_update on public.visitor_visits
  for update using (organization_id in (select public.user_org_ids()));

drop policy if exists vv_delete on public.visitor_visits;
create policy vv_delete on public.visitor_visits
  for delete using (organization_id in (select public.user_org_ids()));

-- Usage counters: read for members; writes via RPC only (no direct insert/update from client)
drop policy if exists usage_select on public.usage_counters;
create policy usage_select on public.usage_counters
  for select using (organization_id in (select public.user_org_ids()));

-- Block direct client mutations on usage_counters (RPC runs as definer)
drop policy if exists usage_no_direct on public.usage_counters;
create policy usage_no_direct on public.usage_counters
  for all using (false);

-- Allow RPC (security definer) to bypass — actually RLS applies to table owner role; SECURITY DEFINER function runs as owner so it can write.

-- New user profile trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
