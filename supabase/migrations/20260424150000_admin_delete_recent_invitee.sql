-- Allow admins to delete auth users who were added to this org recently, belong only to this org, and created no documents.

create or replace function public.admin_invited_delete_eligibility_for_org(p_org_id uuid)
returns table (target_user_id uuid, eligible boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_owner uuid;
  v_ent uuid;
  v_caller uuid;
  v_recent_days int := 30;
  v_doc_count int;
  v_m_created timestamptz;
begin
  v_caller := auth.uid();
  if v_caller is null then
    return;
  end if;

  if not public.can_manage_memberships(p_org_id) then
    return;
  end if;

  select o.entitlement_id into v_ent from public.organizations o where o.id = p_org_id;
  select ae.owner_user_id into v_owner from public.account_entitlements ae where ae.id = v_ent;

  for r in
    select m.user_id as uid
    from public.memberships m
    where m.organization_id = p_org_id
      and m.user_id is distinct from v_owner
  loop
    target_user_id := r.uid;

    if r.uid = v_caller then
      eligible := false;
      reason := 'You cannot delete your own account here.';
      return next;
    elsif (select count(*)::int from public.memberships m where m.user_id = r.uid) <> 1 then
      eligible := false;
      reason := 'This person belongs to more than one company. Remove them from other companies first.';
      return next;
    else
      select m.created_at into v_m_created
      from public.memberships m
      where m.organization_id = p_org_id and m.user_id = r.uid;

      if v_m_created is null then
        eligible := false;
        reason := 'Membership not found.';
        return next;
      elsif v_m_created < (now() - (v_recent_days * interval '1 day')) then
        eligible := false;
        reason := format('Only members added in the last %s days can be removed this way.', v_recent_days);
        return next;
      else
        select
          coalesce((select count(*)::int from public.quotations where created_by_user_id = r.uid), 0)
          + coalesce((select count(*)::int from public.packing_lists where created_by_user_id = r.uid), 0)
          + coalesce((select count(*)::int from public.delivery_challans where created_by_user_id = r.uid), 0)
          + coalesce((select count(*)::int from public.gate_passes where created_by_user_id = r.uid), 0)
          + coalesce((select count(*)::int from public.visitor_visits where created_by_user_id = r.uid), 0)
        into v_doc_count;

        if v_doc_count > 0 then
          eligible := false;
          reason := 'This person has created documents. Deactivate them instead, or delete their data first.';
          return next;
        else
          eligible := true;
          reason := null;
          return next;
        end if;
      end if;
    end if;
  end loop;

  return;
end;
$$;

revoke all on function public.admin_invited_delete_eligibility_for_org(uuid) from public;
grant execute on function public.admin_invited_delete_eligibility_for_org(uuid) to authenticated;
