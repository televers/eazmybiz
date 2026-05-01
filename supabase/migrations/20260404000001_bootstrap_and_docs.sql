-- First organization for a user (Free: one org per account at signup)
create or replace function public.bootstrap_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'already belongs to an organization';
  end if;

  insert into public.organizations (name, plan)
  values (coalesce(nullif(trim(p_name), ''), 'My company'), 'free')
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org, auth.uid(), 'office');

  return v_org;
end;
$$;

revoke all on function public.bootstrap_organization(text) from public;
grant execute on function public.bootstrap_organization(text) to authenticated;

-- Monotonic document numbers per org and type
create or replace function public.next_document_number(p_org_id uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
  v_type text := lower(trim(p_doc_type));
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.is_active
  ) then
    raise exception 'not a member of this organization';
  end if;

  insert into public.document_sequences (organization_id, doc_type, last_number)
  values (p_org_id, v_type, 1)
  on conflict (organization_id, doc_type)
  do update set last_number = public.document_sequences.last_number + 1
  returning last_number into v_next;

  return upper(v_type) || '-' || lpad(v_next::text, 5, '0');
end;
$$;

revoke all on function public.next_document_number(uuid, text) from public;
grant execute on function public.next_document_number(uuid, text) to authenticated;
