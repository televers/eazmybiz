-- Delivery challan: Bill to / Ship to, document meta, transport & compliance fields; goods lines with HSN.

alter table public.delivery_challans
  add column if not exists bill_to jsonb not null default '{}'::jsonb,
  add column if not exists ship_to jsonb not null default '{}'::jsonb,
  add column if not exists document_date date,
  add column if not exists po_no text,
  add column if not exists po_date date,
  add column if not exists lr_docket_no text,
  add column if not exists eway_bill_no text,
  add column if not exists transport_name text,
  add column if not exists transporter_id text,
  add column if not exists vehicle_no text;

update public.delivery_challans
set vehicle_no = vehicle_reg
where vehicle_no is null and vehicle_reg is not null;

alter table public.delivery_challans drop column if exists vehicle_reg;
