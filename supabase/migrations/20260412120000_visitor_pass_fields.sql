-- Visitor pass: contact + vehicle/driver + photo; host & mobile required at app layer.

alter table public.visitor_visits add column if not exists visitor_mobile text;
alter table public.visitor_visits add column if not exists vehicle_reg text;
alter table public.visitor_visits add column if not exists driver_name text;
alter table public.visitor_visits add column if not exists photo_storage_path text;

update public.visitor_visits set visitor_mobile = '' where visitor_mobile is null;
update public.visitor_visits set host_name = '' where host_name is null;

alter table public.visitor_visits alter column visitor_mobile set default '';
alter table public.visitor_visits alter column visitor_mobile set not null;

alter table public.visitor_visits alter column host_name set default '';
alter table public.visitor_visits alter column host_name set not null;

-- Storage: visitor photos (org-scoped paths: {org_id}/{visit_id}.ext)
insert into storage.buckets (id, name, public)
values ('visitor-photos', 'visitor-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists visitor_photos_public_read on storage.objects;
create policy visitor_photos_public_read on storage.objects
  for select to public
  using (bucket_id = 'visitor-photos');

drop policy if exists visitor_photos_member_insert on storage.objects;
create policy visitor_photos_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'visitor-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.is_active
        and m.organization_id::text = split_part(name, '/', 1)
    )
  );

drop policy if exists visitor_photos_member_update on storage.objects;
create policy visitor_photos_member_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'visitor-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.is_active
        and m.organization_id::text = split_part(name, '/', 1)
    )
  );

drop policy if exists visitor_photos_member_delete on storage.objects;
create policy visitor_photos_member_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'visitor-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.is_active
        and m.organization_id::text = split_part(name, '/', 1)
    )
  );
