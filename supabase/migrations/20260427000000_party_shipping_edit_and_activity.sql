-- Shipping addresses: any org member with parties feature may insert/update/delete ship_to rows.
-- Billing (bill_to): still maintainer / company admin / account owner only.
-- Bump parties.updated_at when party_addresses change (security definer; RLS blocks most members from updating parties).
-- Activity log on party detail for edits by members who are not maintainer/admin/owner.

create or replace function public.touch_party_updated_at_from_party_addresses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_party uuid;
begin
  if tg_op = 'DELETE' then
    v_party := old.party_id;
  else
    v_party := new.party_id;
  end if;
  if v_party is not null then
    update public.parties
    set updated_at = now()
    where id = v_party;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_party_addresses_touch_party on public.party_addresses;
create trigger trg_party_addresses_touch_party
  after insert or update or delete on public.party_addresses
  for each row execute function public.touch_party_updated_at_from_party_addresses();

drop policy if exists party_addresses_insert on public.party_addresses;
drop policy if exists party_addresses_update on public.party_addresses;
drop policy if exists party_addresses_delete on public.party_addresses;

create policy party_addresses_insert on public.party_addresses
  for insert with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and (
      address_role = 'ship_to'
      or public.member_can_edit_party_by_id(party_id)
    )
  );

create policy party_addresses_update on public.party_addresses
  for update using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and (
      address_role = 'ship_to'
      or public.member_can_edit_party_by_id(party_id)
    )
  )
  with check (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and (
      address_role = 'ship_to'
      or public.member_can_edit_party_by_id(party_id)
    )
  );

create policy party_addresses_delete on public.party_addresses
  for delete using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and (
      address_role = 'ship_to'
      or public.member_can_edit_party_by_id(party_id)
    )
  );

create table if not exists public.party_edit_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  party_id uuid not null references public.parties (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete set null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists party_edit_activity_party_idx
  on public.party_edit_activity (party_id, created_at desc);

alter table public.party_edit_activity enable row level security;

drop policy if exists party_edit_activity_select on public.party_edit_activity;
create policy party_edit_activity_select on public.party_edit_activity
  for select using (
    organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
  );

drop policy if exists party_edit_activity_insert on public.party_edit_activity;
create policy party_edit_activity_insert on public.party_edit_activity
  for insert with check (
    auth.uid() = actor_user_id
    and organization_id in (select public.user_org_ids())
    and public.membership_feature_allowed(auth.uid(), organization_id, 'parties')
    and exists (
      select 1
      from public.parties p
      where p.id = party_id
        and p.organization_id = party_edit_activity.organization_id
    )
  );
