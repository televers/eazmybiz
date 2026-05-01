-- Default visitor pass print layout per company (ID-1 card vs A5 foldable badge).

alter table public.organizations
  add column if not exists visitor_pass_print_layout text
  not null
  default 'id_card'
  check (visitor_pass_print_layout in ('id_card', 'a5_foldable'));

comment on column public.organizations.visitor_pass_print_layout is
  'Visitor pass print: id_card (ISO ID-1) or a5_foldable (A5 sheet, fold for two-sided badge).';
