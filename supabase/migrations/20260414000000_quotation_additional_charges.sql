-- Optional additional charges (e.g. packing, transport) with tax; max two rows enforced in app.

alter table public.quotations
  add column if not exists additional_charges jsonb not null default '[]'::jsonb;
