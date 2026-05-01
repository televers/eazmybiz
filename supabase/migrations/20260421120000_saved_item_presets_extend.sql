-- Extend saved items to match quotation-style line fields (masters only; documents store JSON snapshots).

alter table public.saved_item_presets
  add column if not exists make_service_provider text not null default '',
  add column if not exists model_part_no_description text not null default '',
  add column if not exists hsn_sac text not null default '';
