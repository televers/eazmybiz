-- Material gate pass: invoice, party link, transport / LR, hand-carried person, package count

alter table public.gate_passes
  add column if not exists invoice_no text,
  add column if not exists party_id uuid references public.parties (id) on delete set null,
  add column if not exists transport_name text,
  add column if not exists lr_docket_no text,
  add column if not exists hand_carried_name text,
  add column if not exists hand_carried_mobile text,
  add column if not exists package_count int;

do $$ begin
  alter table public.gate_passes
    add constraint gate_passes_package_count_nonneg
    check (package_count is null or package_count >= 0);
exception
  when duplicate_object then null;
end $$;

create index if not exists gate_passes_party_id_idx on public.gate_passes (party_id)
  where party_id is not null;
