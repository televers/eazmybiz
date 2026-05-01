alter table public.organizations
  add column if not exists bank_account_holder_name text;
