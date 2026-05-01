-- Commercial region (pricing book: India INR vs international USD) and per-owner entitlements (sketch; payment later).

do $$ begin
  create type commercial_region as enum ('in', 'intl');
exception
  when duplicate_object then null;
end $$;

alter table public.organizations
  add column if not exists commercial_region commercial_region not null default 'in';

alter table public.organizations
  add column if not exists billing_country_code text;

alter table public.organizations
  add column if not exists plan_period_start timestamptz;

alter table public.organizations
  add column if not exists plan_period_end timestamptz;

-- Backfill commercial_region from ISO country (GSTIN/org_country not evaluated in SQL).
update public.organizations o
set commercial_region = case
  when upper(trim(coalesce(o.country_code, ''))) in ('IN', 'IND', 'INDIA') then 'in'::commercial_region
  else 'intl'::commercial_region
end
where true;

create table if not exists public.account_entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  plan plan_tier not null default 'free',
  commercial_region commercial_region not null default 'in',
  max_companies int not null default 1,
  plan_period_start timestamptz,
  plan_period_end timestamptz,
  billing_country_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create index if not exists account_entitlements_owner_idx on public.account_entitlements (owner_user_id);

alter table public.organizations
  add column if not exists entitlement_id uuid references public.account_entitlements (id) on delete set null;

create index if not exists organizations_entitlement_idx on public.organizations (entitlement_id);

-- Max companies allowed for a plan tier (product: Free 1, Pro 2, Max 5).
create or replace function public.plan_max_companies(p plan_tier)
returns integer
language sql
immutable
as $$
  select case p
    when 'free' then 1
    when 'pro' then 2
    when 'max' then 5
  end;
$$;

revoke all on function public.plan_max_companies(plan_tier) from public;
grant execute on function public.plan_max_companies(plan_tier) to authenticated;

-- Backfill entitlements for existing members (one row per user).
insert into public.account_entitlements (owner_user_id, plan, commercial_region, max_companies)
select distinct on (m.user_id)
  m.user_id,
  o.plan,
  o.commercial_region,
  public.plan_max_companies(o.plan)
from public.memberships m
join public.organizations o on o.id = m.organization_id
where m.is_active = true
order by m.user_id, m.created_at asc
on conflict (owner_user_id) do nothing;

-- Attach organizations to an owner's entitlement (prefer office role, then earliest member).
update public.organizations o
set entitlement_id = sub.entitlement_id
from (
  select distinct on (o2.id)
    o2.id as org_id,
    ae.id as entitlement_id
  from public.organizations o2
  inner join public.memberships m on m.organization_id = o2.id and m.is_active = true
  inner join public.account_entitlements ae on ae.owner_user_id = m.user_id
  where o2.entitlement_id is null
  order by o2.id, case when m.role = 'office'::member_role then 0 else 1 end, m.created_at asc
) sub
where o.id = sub.org_id;

alter table public.account_entitlements enable row level security;

-- First-time migration: no DROP needed (avoids NOTICE: policy does not exist). To replace policies, add a new migration.
create policy account_entitlements_select_own on public.account_entitlements
  for select using (owner_user_id = auth.uid());

create policy account_entitlements_update_own on public.account_entitlements
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

-- Bootstrap: create org + entitlement for first-time user.
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

  insert into public.organizations (name, plan, commercial_region)
  values (coalesce(nullif(trim(p_name), ''), 'My company'), 'free', v_region)
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

-- Keep entitlement row aligned when organization.plan changes (single-org MVP; payment flow will own plan changes later).
create or replace function public.sync_entitlement_from_organization_plan()
returns trigger
language plpgsql
as $$
begin
  if new.entitlement_id is not null then
    update public.account_entitlements ae
    set
      plan = new.plan,
      max_companies = public.plan_max_companies(new.plan),
      updated_at = now()
    where ae.id = new.entitlement_id;
  end if;
  return new;
end;
$$;

create trigger trg_org_sync_entitlement_plan
after update of plan on public.organizations
for each row
when (old.plan is distinct from new.plan)
execute procedure public.sync_entitlement_from_organization_plan();
