-- Optional employee directory fields on user profile (per-user, not per-org).

alter table public.profiles
  add column if not exists employee_id text;

alter table public.profiles
  add column if not exists department text;

alter table public.profiles
  add column if not exists mobile text;

comment on column public.profiles.employee_id is 'Optional internal employee / badge ID';
comment on column public.profiles.department is 'Optional department or team name';
comment on column public.profiles.mobile is 'Optional E.164 or app-normalized mobile';
