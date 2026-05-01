-- Saved items: any member with "items" feature may UPDATE presets, except only company admins /
-- subscription owners may change description (name) or default_unit — enforced by trigger (matches can_manage_memberships).
-- DELETE stays maintainer / admin / owner (saved_item_presets_delete unchanged).
-- Activity: HSN/SAC, make, model changes by users who are not admins / owners for this org.

create or replace function public.enforce_saved_item_preset_name_unit_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_manage_memberships(new.organization_id) then
    return new;
  end if;
  if new.description is distinct from old.description
     or new.default_unit is distinct from old.default_unit then
    raise exception 'Only a company admin or the account owner may change the item name or unit';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_saved_item_presets_enforce_name_unit on public.saved_item_presets;
create trigger trg_saved_item_presets_enforce_name_unit
  before update on public.saved_item_presets
  for each row execute function public.enforce_saved_item_preset_name_unit_privilege();

drop policy if exists saved_item_presets_update on public.saved_item_presets;
create policy saved_item_presets_update on public.saved_item_presets
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'items')
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'items')
  );

create table if not exists public.saved_item_edit_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  preset_id uuid not null references public.saved_item_presets (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_item_edit_activity_preset_idx
  on public.saved_item_edit_activity (preset_id, created_at desc);

alter table public.saved_item_edit_activity enable row level security;

drop policy if exists saved_item_edit_activity_select on public.saved_item_edit_activity;
create policy saved_item_edit_activity_select on public.saved_item_edit_activity
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'items')
  );

drop policy if exists saved_item_edit_activity_insert on public.saved_item_edit_activity;
create policy saved_item_edit_activity_insert on public.saved_item_edit_activity
  for insert with check (
    auth.uid() = actor_user_id
    and organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'items')
    and exists (
      select 1
      from public.saved_item_presets s
      where s.id = preset_id
        and s.organization_id = saved_item_edit_activity.organization_id
    )
  );
