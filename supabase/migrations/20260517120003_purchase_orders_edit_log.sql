-- Issued edit audit log: allow purchase orders.

alter table public.issued_document_edit_log drop constraint if exists issued_document_edit_log_doc_kind_check;
alter table public.issued_document_edit_log add constraint issued_document_edit_log_doc_kind_check
  check (doc_kind in ('packing_list', 'quotation', 'purchase_order'));

drop policy if exists issued_document_edit_log_select on public.issued_document_edit_log;
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
      or (
        doc_kind = 'purchase_order'
        and exists (
          select 1
          from public.purchase_orders po
          where po.id = issued_document_edit_log.document_id
            and po.organization_id = issued_document_edit_log.organization_id
            and public.membership_feature_allowed(auth.uid(), po.organization_id, 'purchase_order')
            and public.member_can_see_row_by_creator(po.organization_id, po.created_by_user_id)
        )
      )
    )
  );

drop policy if exists issued_document_edit_log_insert on public.issued_document_edit_log;
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
      or (
        doc_kind = 'purchase_order'
        and exists (
          select 1
          from public.purchase_orders po
          where po.id = issued_document_edit_log.document_id
            and po.organization_id = issued_document_edit_log.organization_id
            and public.membership_feature_allowed(auth.uid(), po.organization_id, 'purchase_order')
            and public.member_can_see_row_by_creator(po.organization_id, po.created_by_user_id)
        )
      )
    )
  );
