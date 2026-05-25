-- Store human-readable change bullets on issued document edit log entries.

alter table public.issued_document_edit_log
  add column if not exists summary_lines text[];
