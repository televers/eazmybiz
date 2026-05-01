-- Block deleting a party while gate passes reference it (app also checks; this enforces in DB).

alter table public.gate_passes
  drop constraint if exists gate_passes_party_id_fkey;

alter table public.gate_passes
  add constraint gate_passes_party_id_fkey
  foreign key (party_id) references public.parties (id) on delete restrict;
