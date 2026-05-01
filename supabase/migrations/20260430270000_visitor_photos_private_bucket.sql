-- Visitor photos: private bucket + authenticated SELECT aligned with visitor_visits RLS (no anonymous read).

update storage.buckets
set public = false
where id = 'visitor-photos';

drop policy if exists visitor_photos_public_read on storage.objects;

-- Paths: {organization_id}/{visit_id}.{ext} (see app upload). SELECT only if the user may SELECT that visit row.
create policy visitor_photos_authenticated_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'visitor-photos'
    and exists (
      select 1
      from public.visitor_visits v
      where v.organization_id::text = split_part(name, '/', 1)
        and v.id::text = split_part(split_part(name, '/', 2), '.', 1)
        and v.organization_id in (select public.user_org_ids())
        and public.membership_feature_allowed(auth.uid(), v.organization_id, 'visitor')
        and (
          public.member_can_see_row_by_creator(v.organization_id, v.created_by_user_id)
          or public.user_can_record_visitor_checkpoint(auth.uid(), v.organization_id)
        )
    )
  );
