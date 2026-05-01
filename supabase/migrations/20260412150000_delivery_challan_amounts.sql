-- Delivery challan: currency, tax/value lines, additional charges (same pattern as quotations).

alter table public.delivery_challans
  add column if not exists currency text not null default 'INR',
  add column if not exists additional_charges jsonb not null default '[]'::jsonb;
