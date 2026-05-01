-- Snapshot creator display name at insert time (from profiles.display_name) for document attribution.
-- Preserved on update alongside created_by_user_id.

alter table public.quotations
  add column if not exists created_by_display_name text;

alter table public.packing_lists
  add column if not exists created_by_display_name text;

alter table public.delivery_challans
  add column if not exists created_by_display_name text;

alter table public.gate_passes
  add column if not exists created_by_display_name text;

alter table public.visitor_visits
  add column if not exists created_by_display_name text;

create or replace function public.document_set_and_preserve_created_by()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    if new.created_by_user_id is null and auth.uid() is not null then
      new.created_by_user_id := auth.uid();
    end if;
    if new.created_by_display_name is null and new.created_by_user_id is not null then
      select nullif(trim(p.display_name::text), '') into v_name
      from public.profiles p
      where p.id = new.created_by_user_id
      limit 1;
      new.created_by_display_name := v_name;
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.created_by_user_id := old.created_by_user_id;
    new.created_by_display_name := old.created_by_display_name;
    return new;
  end if;
  return new;
end;
$$;

update public.quotations q
set created_by_display_name = nullif(trim(p.display_name::text), '')
from public.profiles p
where q.created_by_user_id = p.id
  and q.created_by_display_name is null;

update public.packing_lists q
set created_by_display_name = nullif(trim(p.display_name::text), '')
from public.profiles p
where q.created_by_user_id = p.id
  and q.created_by_display_name is null;

update public.delivery_challans q
set created_by_display_name = nullif(trim(p.display_name::text), '')
from public.profiles p
where q.created_by_user_id = p.id
  and q.created_by_display_name is null;

update public.gate_passes q
set created_by_display_name = nullif(trim(p.display_name::text), '')
from public.profiles p
where q.created_by_user_id = p.id
  and q.created_by_display_name is null;

update public.visitor_visits q
set created_by_display_name = nullif(trim(p.display_name::text), '')
from public.profiles p
where q.created_by_user_id = p.id
  and q.created_by_display_name is null;
