-- Quotations module: customer quote documents (issued quotations count toward documents_combined; see 20260412000000_issue_quotation_documents_quota.sql)

alter table public.organizations
  add column if not exists default_currency text not null default 'INR',
  add column if not exists bank_name text,
  add column if not exists bank_branch text,
  add column if not exists bank_account_no text,
  add column if not exists bank_ifsc text,
  add column if not exists quotation_terms text;

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  doc_number text not null,
  status doc_status not null default 'draft',
  document_date date,
  currency text not null default 'INR',
  bill_to jsonb not null default '{}'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  payment_term text not null default '',
  delivery_inco_term text not null default '',
  terms_notes text,
  notes text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, doc_number)
);

create index if not exists quotations_org_idx on public.quotations (organization_id);

alter table public.quotations enable row level security;

drop policy if exists qt_select on public.quotations;
create policy qt_select on public.quotations
  for select using (organization_id in (select public.user_org_ids()));

drop policy if exists qt_write on public.quotations;
create policy qt_write on public.quotations
  for insert with check (organization_id in (select public.user_org_ids()));

drop policy if exists qt_update on public.quotations;
create policy qt_update on public.quotations
  for update using (organization_id in (select public.user_org_ids()));

drop policy if exists qt_delete on public.quotations;
create policy qt_delete on public.quotations
  for delete using (organization_id in (select public.user_org_ids()));

-- Issue quotation: initial definition; quota applied in 20260412000000_issue_quotation_documents_quota.sql
create or replace function public.issue_quotation(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.quotations%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select * into v_row from public.quotations where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not found');
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.organization_id = v_row.organization_id
      and m.user_id = auth.uid()
      and m.is_active
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_row.status <> 'draft' then
    return jsonb_build_object('ok', false, 'error', 'already issued');
  end if;

  if trim(coalesce(v_row.payment_term, '')) = '' or trim(coalesce(v_row.delivery_inco_term, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'terms required');
  end if;

  update public.quotations
  set status = 'issued',
      issued_at = now(),
      updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.issue_quotation(uuid) from public;
grant execute on function public.issue_quotation(uuid) to authenticated;
