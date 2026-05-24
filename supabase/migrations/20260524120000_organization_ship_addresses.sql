-- Company warehouse / shipping addresses (up to 3 slots per organization).
-- Used on purchase orders (ship to) and editable under company settings.

create table if not exists public.organization_ship_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ship_slot int not null check (ship_slot between 1 and 3),
  label text,
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
  unique (organization_id, ship_slot)
);

create index if not exists organization_ship_addresses_org_idx
  on public.organization_ship_addresses (organization_id);

alter table public.organization_ship_addresses enable row level security;

drop policy if exists organization_ship_addresses_all on public.organization_ship_addresses;
create policy organization_ship_addresses_all on public.organization_ship_addresses
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
