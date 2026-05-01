-- Audit log for edits to issued packing lists and quotations (app inserts after successful save).

create table if not exists public.issued_document_edit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  doc_kind text not null check (doc_kind in ('packing_list', 'quotation')),
  document_id uuid not null,
  edited_at timestamptz not null default now(),
  edited_by_user_id uuid not null references auth.users (id) on delete restrict,
  edited_by_display_name text
);

create index if not exists issued_document_edit_log_doc_idx
  on public.issued_document_edit_log (organization_id, doc_kind, document_id, edited_at desc);

alter table public.issued_document_edit_log enable row level security;

create policy issued_document_edit_log_select on public.issued_document_edit_log
  for select using (
    organization_id in (select public.user_org_ids())
    and (
      (
        doc_kind = 'packing_list'
        and exists (
          select 1
          from public.packing_lists pl
          where pl.id = issued_document_edit_log.document_id
            and pl.organization_id = issued_document_edit_log.organization_id
            and public.membership_feature_allowed(auth.uid(), pl.organization_id, 'packing_list')
            and public.member_can_see_row_by_creator(pl.organization_id, pl.created_by_user_id)
        )
      )
      or (
        doc_kind = 'quotation'
        and exists (
          select 1
          from public.quotations q
          where q.id = issued_document_edit_log.document_id
            and q.organization_id = issued_document_edit_log.organization_id
            and public.membership_feature_allowed(auth.uid(), q.organization_id, 'quotation')
            and public.member_can_see_row_by_creator(q.organization_id, q.created_by_user_id)
        )
      )
    )
  );

create policy issued_document_edit_log_insert on public.issued_document_edit_log
  for insert with check (
    organization_id in (select public.user_org_ids())
    and edited_by_user_id = auth.uid()
    and (
      (
        doc_kind = 'packing_list'
        and exists (
          select 1
          from public.packing_lists pl
          where pl.id = issued_document_edit_log.document_id
            and pl.organization_id = issued_document_edit_log.organization_id
            and public.membership_feature_allowed(auth.uid(), pl.organization_id, 'packing_list')
            and public.member_can_see_row_by_creator(pl.organization_id, pl.created_by_user_id)
        )
      )
      or (
        doc_kind = 'quotation'
        and exists (
          select 1
          from public.quotations q
          where q.id = issued_document_edit_log.document_id
            and q.organization_id = issued_document_edit_log.organization_id
            and public.membership_feature_allowed(auth.uid(), q.organization_id, 'quotation')
            and public.member_can_see_row_by_creator(q.organization_id, q.created_by_user_id)
        )
      )
    )
  );

revoke all on public.issued_document_edit_log from public;
grant select, insert on public.issued_document_edit_log to authenticated;
