alter table public.organizations
  add column if not exists delivery_challan_terms text;
