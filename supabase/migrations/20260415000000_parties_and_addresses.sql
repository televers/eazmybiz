-- Parties: one bill-to and up to three ship-to addresses per party.
-- Migrates existing saved_parties rows into parties + party_addresses (bill_to only).

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parties_org_idx on public.parties (organization_id);

create table if not exists public.party_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  party_id uuid not null references public.parties (id) on delete cascade,
  address_role text not null check (address_role in ('bill_to', 'ship_to')),
  ship_slot int,
  name text not null default '',
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pin text,
  country text,
  gstin text,
  contact_name text,
  mobile text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (address_role = 'bill_to' and ship_slot is null)
    or (address_role = 'ship_to' and ship_slot between 1 and 3)
  )
);

create unique index if not exists party_addresses_one_bill
  on public.party_addresses (party_id)
  where address_role = 'bill_to';

create unique index if not exists party_addresses_ship_slot
  on public.party_addresses (party_id, ship_slot)
  where address_role = 'ship_to';

create index if not exists party_addresses_org_idx on public.party_addresses (organization_id);
create index if not exists party_addresses_party_idx on public.party_addresses (party_id);

-- Migrate saved_parties → parties + bill_to row (preserve party id for stable references)
insert into public.parties (id, organization_id, display_name, created_at, updated_at)
select id, organization_id, name, created_at, updated_at
from public.saved_parties;

insert into public.party_addresses (
  organization_id,
  party_id,
  address_role,
  ship_slot,
  name,
  address_line1,
  address_line2,
  city,
  state,
  pin,
  country,
  gstin,
  contact_name,
  mobile,
  created_at,
  updated_at
)
select
  organization_id,
  id,
  'bill_to',
  null,
  name,
  address_line1,
  address_line2,
  city,
  state,
  pin,
  country,
  gstin,
  contact_name,
  mobile,
  created_at,
  updated_at
from public.saved_parties;

drop table if exists public.saved_parties;

alter table public.parties enable row level security;
alter table public.party_addresses enable row level security;

drop policy if exists parties_all on public.parties;
create policy parties_all on public.parties
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

drop policy if exists party_addresses_all on public.party_addresses;
create policy party_addresses_all on public.party_addresses
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
