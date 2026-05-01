-- Dedicated calendar visit date for visitor passes (wall date in Asia/Kolkata in the app).
alter table public.visitor_visits
  add column if not exists visit_date date;

update public.visitor_visits
set visit_date = coalesce(
  (issued_at at time zone 'Asia/Kolkata')::date,
  (created_at at time zone 'Asia/Kolkata')::date
)
where visit_date is null;

alter table public.visitor_visits alter column visit_date set not null;
