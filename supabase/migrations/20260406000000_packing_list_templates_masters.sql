-- Packing list refinement: consigner branding, package rows, templates, saved masters

do $$ begin
  create type packing_list_template as enum ('basic', 'standard_pro');
exception
  when duplicate_object then null;
end $$;

-- Consigner / company display fields (fixed per organization)
alter table public.organizations
  add column if not exists org_address_line1 text,
  add column if not exists org_address_line2 text,
  add column if not exists org_city text,
  add column if not exists org_state text,
  add column if not exists org_pin text,
  add column if not exists org_country text default 'India',
  add column if not exists org_email text,
  add column if not exists logo_storage_path text,
  add column if not exists packing_terms text;

-- Packing lists: template, document meta, parties, packages (replaces flat line_items)
alter table public.packing_lists
  add column if not exists template packing_list_template not null default 'basic'::packing_list_template,
  add column if not exists invoice_no text,
  add column if not exists document_date date,
  add column if not exists bill_to jsonb not null default '{}'::jsonb,
  add column if not exists ship_to jsonb not null default '{}'::jsonb,
  add column if not exists packages jsonb;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'packing_lists'
      and column_name = 'line_items'
  ) then
    update public.packing_lists pl
    set packages = jsonb_build_array(
      jsonb_build_object(
        'package_no', 1,
        'package_type', '',
        'package_size', '',
        'package_weight_kg', null,
        'packing_remarks', '',
        'lines', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'description', e->>'description',
                'qty', (e->>'qty')::numeric,
                'unit', coalesce(nullif(e->>'uom', ''), 'Pcs')
              )
            )
            from jsonb_array_elements(coalesce(pl.line_items, '[]'::jsonb)) e
          ),
          '[]'::jsonb
        )
      )
    )
    where pl.packages is null;

    alter table public.packing_lists drop column line_items;
  end if;
end $$;

update public.packing_lists
set packages = '[]'::jsonb
where packages is null;

alter table public.packing_lists
  alter column packages set not null;

-- Saved parties (Bill to / Ship to reuse)
create table if not exists public.saved_parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
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
  updated_at timestamptz not null default now()
);

create index if not exists saved_parties_org_idx on public.saved_parties (organization_id);

-- Saved item description presets
create table if not exists public.saved_item_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  description text not null,
  default_unit text not null default 'Pcs',
  created_at timestamptz not null default now()
);

create index if not exists saved_item_presets_org_idx on public.saved_item_presets (organization_id);

alter table public.saved_parties enable row level security;
alter table public.saved_item_presets enable row level security;

drop policy if exists saved_parties_all on public.saved_parties;
create policy saved_parties_all on public.saved_parties
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

drop policy if exists saved_item_presets_all on public.saved_item_presets;
create policy saved_item_presets_all on public.saved_item_presets
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- Storage: public logos bucket
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists org_logos_public_read on storage.objects;
create policy org_logos_public_read on storage.objects
  for select to public
  using (bucket_id = 'org-logos');

drop policy if exists org_logos_member_insert on storage.objects;
create policy org_logos_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-logos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.is_active
        and m.organization_id::text = split_part(name, '/', 1)
    )
  );

drop policy if exists org_logos_member_update on storage.objects;
create policy org_logos_member_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'org-logos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.is_active
        and m.organization_id::text = split_part(name, '/', 1)
    )
  );

drop policy if exists org_logos_member_delete on storage.objects;
create policy org_logos_member_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-logos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.is_active
        and m.organization_id::text = split_part(name, '/', 1)
    )
  );
