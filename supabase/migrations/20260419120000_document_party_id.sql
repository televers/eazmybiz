-- Link quotations, packing lists, and delivery challans to parties (nullable; backend-only usage in app).

alter table public.quotations
  add column if not exists party_id uuid references public.parties (id) on delete set null;

alter table public.packing_lists
  add column if not exists party_id uuid references public.parties (id) on delete set null;

alter table public.delivery_challans
  add column if not exists party_id uuid references public.parties (id) on delete set null;

create index if not exists quotations_org_party_id_idx
  on public.quotations (organization_id, party_id)
  where party_id is not null;

create index if not exists packing_lists_org_party_id_idx
  on public.packing_lists (organization_id, party_id)
  where party_id is not null;

create index if not exists delivery_challans_org_party_id_idx
  on public.delivery_challans (organization_id, party_id)
  where party_id is not null;
