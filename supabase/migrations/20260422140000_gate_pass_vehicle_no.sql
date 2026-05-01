alter table public.gate_passes
  add column if not exists vehicle_no text;
